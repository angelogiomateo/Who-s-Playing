const app = {}
app.module = $(".module");
app.songkickKey = "7de5yoQdR3IFLo4W";

// Authorization for Spotify API
const headers = {
    "Authorization": `Basic YTE4YTFjMWI1YjY1NGY5MmJkOTNjYTY2MDNiZjQ0YzY6YTBlNTRjNGUzZjU4NGU2NWJlYzA4NDE2NjRkYTVmZGU=`
}

let authHeaders = {};

app.auth = () => $.ajax({
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    url: 'http://proxy.hackeryou.com ',
    data: JSON.stringify({
        reqUrl: `https://accounts.spotify.com/api/token`,
        params: {
            grant_type: 'client_credentials'
        },
        proxyHeaders: headers
    })
});

// Get metroAreaID from Songkick Location Search, using user geolocation
app.songkickLocation = function() {
    return new Promise((resolve, reject) => {
            // Get user geolocation
            navigator.geolocation.watchPosition((position) => {
                resolve(position);
            }, (err) => {
                reject(err);
            });
        })
        .then((position) => {
            app.userLat = position.coords.latitude;
            app.userLng = position.coords.longitude;

            return $.ajax({
                url: `http://api.songkick.com/api/3.0/search/locations.json?location=geo:${app.userLat},${app.userLng}&apikey=${app.songkickKey}`,
                type: 'GET',
                dataType: 'json'
            });
        })
        .catch((err) => {
            console.log(err);
        });


}

// Get concert listings from Songkick request
app.songkickConcerts = function(metroAreaID, pageNum) {
    return $.ajax({
        url: `http://api.songkick.com/api/3.0/metro_areas/${metroAreaID}/calendar.json`,
        type: 'GET',
        data: {
            apikey: app.songkickKey,
            per_page: 100,
            page: pageNum
        },
        dataType: 'json',
    });
};

app.songkickLocation()
    .then(function(result) {
        // console.log(result);
        // Get Metroarea ID if not undefined
        if (result.resultsPage.results.location != undefined) {
            app.metroAreaID = result.resultsPage.results.location["0"].metroArea.id;
        } else if (result.resultsPage.results.location = undefined) {
            $(".band-box").append(`<h1>No concerts found!</h1>`);
        }
        // console.log(metroAreaID);
        // Page 1 of Songkick Concert Request
        return app.songkickConcerts(app.metroAreaID, 1)
    })
    .then(function(result) {
        // console.log(result);
        // Create array of concert events
        app.unsortedConcertArray = result.resultsPage.results.event;
        // console.log(app.unsortedConcertArray)
        // Page 2 of Songkick Concert Request
        return app.songkickConcerts(app.metroAreaID, 2)
    })
    .then(function(result) {
        // Create temporary array for page 2
        app.unsortedConcertArray2 = result.resultsPage.results.event
        // console.log(app.unsortedConcertArray2);
        if (app.unsortedConcertArray2 != undefined) {
            // Merge concert arrays
            app.unsortedConcertArray = app.unsortedConcertArray.concat(app.unsortedConcertArray2);
        }
        // console.log(app.unsortedConcertArray);
        return app.songkickConcerts(app.metroAreaID, 3)
    })
    .then(function(result) {
        // Create temporary array for page 2
        app.unsortedConcertArray3 = result.resultsPage.results.event
        // console.log(app.unsortedConcertArray3);
        if (app.unsortedConcertArray3 != undefined) {
            // Merge concert arrays
            app.unsortedConcertArray = app.unsortedConcertArray.concat(app.unsortedConcertArray3);
            // console.log(app.unsortedConcertArray);
        }
        // Filter for popular concerts
        app.popularConcerts = app.unsortedConcertArray.filter(function(concert) {
            if (concert.popularity >= 0.02) {
                return concert;
            }
        });

        // console.log(app.popularConcerts);

        // Create Array of objects of concert information
        var concertsInfo = app.popularConcerts.map(function(concert) {
            return {
                artist: concert.performance["0"].displayName,
                date: concert.start.date,
                time: concert.start.time,
                venue: concert.venue.displayName,
                lat: concert.venue.lat,
                lng: concert.venue.lng
            }
        });
        // console.log(concertsInfo);

        // Loop though array of concert info and create HTML using Data Attributes
        concertsInfo.forEach(function(concert) {
            var concertHTML = $("<a>").addClass("band hvr-grow").attr("href", "#").attr({
                "data-name": concert.artist,
                "data-date": concert.date,
                "data-time": concert.time,
                "data-venue": concert.venue,
                "data-lat": concert.lat,
                "data-lng": concert.lng
            }).append("<div class='band-overlay2'><h1 class='band-name-overlay'></h1></div>");
            $(".band-box").append(concertHTML);
        });

        // Create array of Band Names for later use
        app.bandNames = concertsInfo.map(function(concert) {
            return concert.artist
        });

        // console.log(app.bandNames);

        app.getBandPhotos().then(function() {
                // console.log(app.bandPhotosArray);
                app.changeBandPhotos();
                app.addNameOverlay();
            })
            // Wait for API requests to finish to load page
            .then(function() {
                // Hide loading graphic
                $(".loader-box").fadeOut("slow", function() {});
            })
            .then(function() {
                $("main").animate({ opacity: 1 }, 750);
            });
    });

// Create array of Spotify promises using names of bands
app.spotifyArtistSearch = function() {
    const spotifySearchPromiseArray = app.bandNames.map(function(name) {
        return $.ajax({
            url: 'https://api.spotify.com/v1/search',
            method: 'GET',
            dataType: 'json',
            headers: authHeaders,
            data: {
                type: 'artist',
                q: name
            }
        });
    });
    return $.when(...spotifySearchPromiseArray)
};

// Gets band photos from Spotify data
app.getBandPhotos = function() {
    return app.spotifyArtistSearch().then(function(...res) {
        // Returns array of photo URLs
        app.bandPhotosArray = res.map(function(artist) {
            // console.log(artist)
            if (artist[0].artists.items.length > 0 && artist[0].artists.items[0] != undefined) {
                return artist[0].artists.items[0].images[0].url;
            };
        });
        // console.log(res);
        // Returns array of Artist IDs
        app.artistID = res.map(function(artist) {
            if (artist[0].artists.items.length > 0 && artist[0].artists.items[0] != undefined) {
                return artist[0].artists.items[0].id;
            }
        });
        // console.log(app.artistID);
        app.dataArtistID();
        //Returns array of Artist URI
        app.artistURI = res.map(function(artist) {
            if (artist[0].artists.items.length > 0 && artist[0].artists.items[0] != undefined) {
                return artist[0].artists.items[0].uri;
            }
        });
        // console.log(app.artistURI);
        app.dataArtistURI();
    });
};

// Creates Data Attribute for Artist ID
app.dataArtistID = function() {
    $(".band").each(function(i) {
        $(this).attr("data-artistID", app.artistID[i]);
    });
}

// Creates Data Attribute for Artist URI
app.dataArtistURI = function() {
    $(".band").each(function(i) {
        $(this).attr("data-artisturi", app.artistURI[i]);
    });
}

// Changes band photos based on photo URLs
app.changeBandPhotos = function() {
    $(".band").each(function(i) {
        if (app.bandPhotosArray[i] === undefined) {
            $(this).addClass("noImage");
        } else {
            $(this).css("background-image", `url(${app.bandPhotosArray[i]})`);
        };
        // console.log(app.bandNames[i]);
    });
};

// Adds name onto band photo
app.addNameOverlay = function() {
    $(".band-name-overlay").each(function(i) {
        $(this).text(`${app.bandNames[i]}`);
    });
};

app.bandInfo = function() {
    // Gets background-image property/URL from band photo
    const image = app.band.css("background-image");
    // console.log(image)
    // Places band photo image as module background
    app.module.css("background-image", image);

    // Gets HTML from hidden description/data attributes
    let bandName = app.band.data("name");
    let bandDate = app.band.data("date");
    let bandTime = app.band.data("time");
    let bandVenue = app.band.data("venue");
    let bandLat = app.band.data("lat");
    let bandLng = app.band.data("lng");
    let spotifyArtistID = app.band.data("artistid");
    let spotifyArtistURI = app.band.data("artisturi");
    // Dump HTML
    $(".bandName").text(bandName);
    $(".bandDate").text(bandDate);
    if (bandTime != null) {
        $(".bandTime").text(bandTime);
    }
    $(".bandVenue").text(bandVenue);

    // Create Spotify Player
    $(".spotifyplayer").append(`<iframe src="https://open.spotify.com/embed?uri=${spotifyArtistURI}" style="border: 0; width: 100%; height: 380px;" allowfullscreen></iframe>`);

    // Show related artists
    app.spotifyRelatedArtists = function() {
        // console.log(spotifyArtistID);
        return $.ajax({
            url: `https://api.spotify.com/v1/artists/${spotifyArtistID}/related-artists`,
            method: 'GET',
            dataType: 'json',
            headers: authHeaders,
        });
    };

    app.spotifyRelatedArtists().then(function(related) {
        // console.log(related);
        app.unsortedRelatedArtists = related.artists;
        // console.log(app.unsortedRelatedArtists);
        // Filter for only popular artists
        app.popularArtists = app.unsortedRelatedArtists.filter(function(artist) {
            if (artist.popularity >= 60) {
                return artist
            }
        });
        console.log(app.popularArtists);
        app.popularArtists.forEach(function(artist) {
            // console.log(artist.name);
            // Create list of related artists
            $(".relatedArtists").append(`<a href="${artist.external_urls.spotify}" target="_blank">${artist.name}</a>`);
        });
    });

    // Create Google Map of the venue
    app.loadMap = function() {

        app.mapOptions = {
            center: new google.maps.LatLng(bandLat, bandLng),
            draggable: true,
            zoom: 15
        };

        const $mapDiv = $(".map")[0];

        app.map = new google.maps.Map($mapDiv, app.mapOptions);
    };

    app.loadMarkers = function() {
        var venue = new google.maps.Marker({
            position: new google.maps.LatLng(bandLat, bandLng),
            map: app.map
        });

        var mapModule = new google.maps.InfoWindow({
            content: `${bandVenue}`
        });

        venue.addListener("click", function() {
            mapModule.open(app.map, venue);
        });

    };

    app.loadMap();
    app.loadMarkers();



};

// Display overlay (goes from display:none to display:flex)
app.displayOverlay = function() {
    $(".overlay").css({ opacity: 0, display: 'flex' }).animate({
        opacity: 1
    }, 500);
};



// Click outside of Module to close
app.clickClose = function() {
    $(document).on("mouseup", function(e) {
        e.preventDefault();
        // If the target is not the module, and the target is not a child of the module
        if (!app.module.is(e.target) && app.module.has(e.target).length === 0) {
            $(".overlay").fadeOut(250, function() {
                $(".bandName").text("");
                $(".bandDate").text("");
                $(".bandTime").text("");
                $(".bandVenue").text("");
                $(".relatedArtists a").remove();
                $(".spotifyplayer").empty();
            });
        };
    });
};

// Click exit button to close
app.exitButton = function() {
    $(".fa-times").on("click", function(e) {
        e.preventDefault();
        $(".overlay").fadeOut(250, function() {
            $(".bandName").text("");
            $(".bandDate").text("");
            $(".bandTime").text("");
            $(".bandVenue").text("");
            $(".relatedArtists a").remove();
            $(".spotifyplayer").empty();
        });
    });
};

app.search = function() {
    // Input of Search
    $("form").on("keyup", function(e) {
        e.preventDefault();
        $(".searchResults").empty()
        let input = $(".js-search").val();
        input = input.toLowerCase();

        //Filter through Band Names Array
        const searchResult = app.bandNames.filter(function(name) {
            // console.log(app.bandNames);
            // console.log(name);
            if (name.toLowerCase().startsWith(input) === true) {
                return name;
            };
        });

        // console.log(searchResult);

        // Hide all band photos
        $(".band").hide();
        const selectedBandsHTML = [];
        // Loop through searchResult array
        searchResult.forEach(function(result) {

            // Find images of search result and add to "selectedBandsHTML" array
            const $results = $(`[data-name="${result}"]`);
            selectedBandsHTML.push($results);
            console.log($results);


            selectedBandsHTML.forEach(function(result) {
                result.show("slow");
            });


        });

    });

};

app.init = function() {
    app.auth().then((data) => {
        authHeaders = {
            "Authorization": `${data.token_type} ${data.access_token}`
        };


        // Click band photo
        $("body").on("click", ".band", function(e) {
            $(".description").animate({
                scrollTop: 0
            }, 'slow');
            $(".desc-info").animate({
                scrollTop: 0
            }, 'slow');
            // Prevent click on link from resetting
            e.preventDefault();
            // Display overlay (goes from display:none to display:flex)
            app.displayOverlay();
            app.band = $(this);
            // Grab info and fill HTML
            app.bandInfo();
            // Click outside of Module to close
            app.clickClose();
            // Click exit button to close
            app.exitButton();
        });

        // Search function
        app.search();

    });



};

$(function() {
    $('input').focus();
    app.init();
});