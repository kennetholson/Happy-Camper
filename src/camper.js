var https = require('https');
var xml2js = require('xml2js');
var util = require('util')
var parseString = require('xml2js').parseString
var campgrounds = require('./campgrounds')


exports.handler = (event, context) => {

  try {
    console.log(event.request.intent);

    switch (event.request.type) {
      case "LaunchRequest":
        context.succeed(
          generateResponse(
            buildSpeechletResponseWithReprompt("Welcome to Happy Camper. You can find California campgrounds, or get details about a campground. What campground information would you like?",
              false,
              "Try saying, 'Tell me about Pine Point'. 'Can I take my dog to Black Rock?'. 'Find campgrounds around Joshua Tree'. What campground information would you like?"),
            {}
          )
        )

        break;

      case "IntentRequest":

        switch (event.request.intent.name) {
          case "GetCampgrounds":

            if (event.request.intent.slots.Location.value == null) {
                          context.succeed(
                            generateResponse(
                              buildSpeechletResponseWithReprompt("Sorry, I didn\'t get the Location. Please, repeat your question with the name of the Location.",
                                false,
                                "Please, repeat your question with the name of the Location.")
                            )
                          )
                        }
            else {
              var city = event.request.intent.slots.Location.value
              var geolocationEndpoint = "https://maps.googleapis.com/maps/api/geocode/json?address=" + city + ",California&key=" + Google_Key;
              var geolocationBody = "";

              https.get(geolocationEndpoint, (response) => {
                response.on('data', (chunk) => { geolocationBody += chunk })
                response.on('end', () => {
                  var data = JSON.parse(geolocationBody);
                  var lat = data.results[0].geometry.location.lat;
                  var lng = data.results[0].geometry.location.lng;

                  var campgroundEndpoint = "https://api.amp.active.com/camping/campgrounds?landmarkName=true&landmarkLat=" + lat + "&landmarkLong=" + lng + "&api_key=" + Active_key;
                  var campgroundBody = "";
                  https.get(campgroundEndpoint, (response) => {
                    response.on('data', (chunk) => { campgroundBody += chunk })
                    response.on('end', () => {
                      parseString(campgroundBody, function (err, result) {
                        var camps = result;
                        campArray = [];
                        var step;
                        for (step = 0; step < 5; step++) {
                          campArray.push(camps.resultset.result[step].$.facilityName);
                        }
                        context.succeed(
                          generateResponse(
                            buildSpeechletResponse("Here are the 5 closest campgrounds, " + campArray.toString(), true),
                            {}
                          )
                        )
                      });
                    });
                  });
                });
              });
            }
            break;

          case "GetPetPolicy":

            if (event.request.intent.slots.Campground.value == null) {
              context.succeed(
                generateResponse(
                  buildSpeechletResponseWithReprompt("Sorry, I didn\'t get the campground name. Please, repeat your question with the name of the campground.",
                    false,
                    "Please, repeat your question with the name of the campground.")
                )
              )
            }
            else {
              if (CampOk(event.request.intent.slots.Campground.value) == "") {
                context.succeed(
                  generateResponse(
                    buildSpeechletResponseWithReprompt("Sorry, I do not have information on " + event.request.intent.slots.Campground.value, true)
                  )
                )

              }
              else {

                var site = CampOk(event.request.intent.slots.Campground.value);                    
                var campEndpoint = "https://api.amp.active.com/camping/campgrounds?pname=" + site + "&pstate=CA&api_key=" + Active_key
                  
                var campBody = "";
                https.get(campEndpoint, (response) => {
                  response.on('data', (chunk) => { campBody += chunk })
                  response.on('end', () => {
                    parseString(campBody, function (err, result) {
                      var camps = result;
                      if (camps.resultset.result[0].$.sitesWithPetsAllowed == "Y") {
                        context.succeed(
                          generateResponse(
                            buildSpeechletResponse("yes, " + site + " is pet friendly", true),
                            {}
                          )
                        )
                      }
                      else if (camps.resultset.result[0].$.sitesWithPetsAllowed == "N") {
                        context.succeed(
                          generateResponse(
                            buildSpeechletResponse("no, " + site + " is not pet friendly", true),
                            {}
                          )
                        )

                      } else {
                        context.succeed(
                          generateResponse(
                            buildSpeechletResponse("Sorry, there is no Pet Policy information for " + site, true),
                            {}
                          )
                        )
                      }
                    })
                  })
                })
              }

            }

            break;

          case "GetDescription":
            if (event.request.intent.slots.Campground.value == null) {
              context.succeed(
                generateResponse(
                  buildSpeechletResponseWithReprompt("Sorry, I didn\'t get the campground name. Please, repeat your question with the name of the campground.",
                    false,
                    "Please, repeat your question with the name of the campground.")
                )
              )
            }
            else {
              if (CampOk(event.request.intent.slots.Campground.value) == "") {
                context.succeed(
                  generateResponse(
                    buildSpeechletResponseWithReprompt("Sorry, I do not have information on " + event.request.intent.slots.Campground.value, true)
                  )
                )

              }
              else {
                var site = CampOk(event.request.intent.slots.Campground.value)
                var campEndpoint = "https://api.amp.active.com/camping/campgrounds?pname=" + site + "&pstate=CA&api_key=" + Active_key;
                var campBody = "";

                https.get(campEndpoint, (response) => {
                  response.on('data', (chunk) => { campBody += chunk })
                  response.on('end', () => {
                    parseString(campBody, function (err, result) {
                      var camps = result;
                      var contractCode = camps.resultset.result[0].$.contractID;
                      var parkId = camps.resultset.result[0].$.facilityID;

                      return new Promise(function getCampDetails() {
                        var campDetailsEndpoint = "https://api.amp.active.com/camping/campground/details?contractCode=" + contractCode + "&parkId=" + parkId + "&api_key=" + Active_key;
                        var campDetailsBody = "";
                        if (err) reject(err);
                        else https.get(campDetailsEndpoint, (response) => {
                          response.on('data', (chunk) => { campDetailsBody += chunk })
                          response.on('end', () => {
                            parseString(campDetailsBody, function (err, result) {
                              var campDetails = result;
                              if (campDetails.detailDescription.bulletin[0] === "") {
                                var verb_response = campDetails.detailDescription.$.description + " " + campDetails.detailDescription.$.facilitiesDescription + " " + campDetails.detailDescription.$.recreationDescription;
                              } else {
                                var verb_response = "There is an alert for " + site + ". " + campDetails.detailDescription.bulletin[0].$.description + " " + campDetails.detailDescription.$.description + " " + campDetails.detailDescription.$.facilitiesDescription + campDetails.detailDescription.$.recreationDescription
                              }
                              var clean_response = verb_response.replace(/&amp.*? /g, "'s ");
                              context.succeed(
                                generateResponse(
                                  buildSpeechletResponse(clean_response.replace(/(P|p)lease (c|C)lick.*?gt|(c|C)lick {1,}(h|H)ere|Click {1,}(h|H)ere|&amp;quot;|&lt.*?&gt/g, " "), true),
                                  {}
                                )
                              )
                            });
                          });
                        });
                      }
                      );
                    });
                  });
                });
              }
            }

            break; //case "GetDescription

          case "GetAmenities":
            if (event.request.intent.slots.Campground.value == null) {
              context.succeed(
                generateResponse(
                  buildSpeechletResponseWithReprompt("Sorry, I didn\'t get the campground name. Please, repeat your question with the name of the campground.",
                    false,
                    "Please, repeat your question with the name of the campground.")
                )
              )
            }
            else {
              if (CampOk(event.request.intent.slots.Campground.value) == "") {
                context.succeed(
                  generateResponse(
                    buildSpeechletResponseWithReprompt("Sorry, I do not have information on " + event.request.intent.slots.Campground.value, true)
                  )
                )

              }
              else {
                var site = CampOk(event.request.intent.slots.Campground.value);
                var campEndpoint = "https://api.amp.active.com/camping/campgrounds?pname=" + site + "&pstate=CA&api_key=" + Active_key;
                var campBody = "";

                https.get(campEndpoint, (response) => {
                  response.on('data', (chunk) => { campBody += chunk })
                  response.on('end', () => {
                    parseString(campBody, function (err, result) {
                      var camps = result;
                      var contractCode = camps.resultset.result[0].$.contractID;
                      var parkId = camps.resultset.result[0].$.facilityID;

                      return new Promise(function getCampDetails() {
                        var campDetailsEndpoint = "https://api.amp.active.com/camping/campground/details?contractCode=" + contractCode + "&parkId=" + parkId + "&api_key=" + Active_key;
                        var campDetailsBody = "";
                        if (err) reject(err);
                        else https.get(campDetailsEndpoint, (response) => {
                          response.on('data', (chunk) => { campDetailsBody += chunk })
                          response.on('end', () => {
                            parseString(campDetailsBody, function (err, result) {
                              var campDetails = result;
                              var amenities = [];
                              var count;
                              for (count = 0; count < campDetails.detailDescription.amenity.length; count++) {
                                if (campDetails.detailDescription.amenity[count].$.distance === "Within Facility") {
                                  amenities.push(campDetails.detailDescription.amenity[count].$.name);
                                }
                              }
                              if (amenities.length > 0) {
                                verb_response = amenities.toString();
                              }
                              else {
                                verb_response = "Sorry, there is no information about amenities at " + site;
                              }

                              context.succeed(
                                generateResponse(
                                  buildSpeechletResponse("The available amenities in " + site + " are," + verb_response, true),
                                  {}
                                )
                              );
                            });
                          });
                        });
                      }
                      );
                    });
                  });
                });
              };
            }
            break;

          case "GetDirections":
            if (event.request.intent.slots.Campground.value == null) {
              context.succeed(
                generateResponse(
                  buildSpeechletResponseWithReprompt("Sorry, I didn\'t get the campground name. Please, repeat your question with the name of the campground.",
                    false,
                    "Please, repeat your question with the name of the campground.")
                )
              )
            }
            else {
              if (CampOk(event.request.intent.slots.Campground.value) == "") {
                context.succeed(
                  generateResponse(
                    buildSpeechletResponseWithReprompt("Sorry, I do not have information on " + event.request.intent.slots.Campground.value,true)
                  )
                )

              }
              else {
                var verb_response = "";
                var site = CampOk(event.request.intent.slots.Campground.value);

                var campEndpoint = "https://api.amp.active.com/camping/campgrounds?pname=" + site + "&pstate=CA&api_key=" + Active_key;
                var campBody = "";
                https.get(campEndpoint, (response) => {
                  response.on('data', (chunk) => { campBody += chunk })
                  response.on('end', () => {
                    parseString(campBody, function (err, result) {
                      var camps = result;
                      var contractCode = camps.resultset.result[0].$.contractID;
                      var parkId = camps.resultset.result[0].$.facilityID;

                      return new Promise(function getCampDetails() {
                        var campDetailsEndpoint = "https://api.amp.active.com/camping/campground/details?contractCode=" + contractCode + "&parkId=" + parkId + "&api_key=" + Active_key;
                        var campDetailsBody = "";
                        if (err) reject(err);
                        else https.get(campDetailsEndpoint, (response) => {
                          response.on('data', (chunk) => { campDetailsBody += chunk })
                          response.on('end', () => {
                            parseString(campDetailsBody, function (err, result) {
                              var campDetails = result;
                              if (campDetails.detailDescription.$.drivingDirection != "") {
                                verb_response = campDetails.detailDescription.$.drivingDirection;
                              }
                              else {
                                verb_response = "Sorry, there are no Driving Directions available for " + site;
                              }
                              context.succeed(
                                generateResponse(
                                  buildSpeechletResponse(verb_response, true),
                                  {}
                                )
                              )
                            });
                          });
                        });
                      }
                      );
                    });
                  });
                });
              };
            }
            break;

          case "GetNearbyAttractions":
            if (event.request.intent.slots.Campground.value == null) {
              context.succeed(
                generateResponse(
                  buildSpeechletResponseWithReprompt("Sorry, I didn\'t get the campground name. Please, repeat your question with the name of the campground.",
                    false,
                    "Please, repeat your question with the name of the campground.")
                )
              )
            }
            else {
              if (CampOk(event.request.intent.slots.Campground.value) == "") {
                context.succeed(
                  generateResponse(
                    buildSpeechletResponseWithReprompt("Sorry, I do not have information on " + event.request.intent.slots.Campground.value,true)
                  )
                )

              }
              else {
                var verb_response = "";
                var site = CampOk(event.request.intent.slots.Campground.value);

                var campEndpoint = "https://api.amp.active.com/camping/campgrounds?pname=" + site + "&pstate=CA&api_key=" + Active_key;
                var campBody = "";
                https.get(campEndpoint, (response) => {
                  response.on('data', (chunk) => { campBody += chunk })
                  response.on('end', () => {
                    parseString(campBody, function (err, result) {
                      var camps = result;
                      var contractCode = camps.resultset.result[0].$.contractID;
                      var parkId = camps.resultset.result[0].$.facilityID;

                      return new Promise(function getCampDetails() {
                        var campDetailsEndpoint = "https://api.amp.active.com/camping/campground/details?contractCode=" + contractCode + "&parkId=" + parkId + "&api_key=" + Active_key;
                        var campDetailsBody = "";
                        if (err) reject(err);
                        else https.get(campDetailsEndpoint, (response) => {
                          response.on('data', (chunk) => { campDetailsBody += chunk })
                          response.on('end', () => {
                            parseString(campDetailsBody, function (err, result) {
                              var campDetails = result;
                              if (campDetails.detailDescription.$.nearbyAttrctionDescription != "") {
                                verb_response = campDetails.detailDescription.$.nearbyAttrctionDescription;
                              }
                              else {
                                verb_response = "Sorry, there is no information about Nearby Attractions for this site"
                              }
                              context.succeed(
                                generateResponse(
                                  buildSpeechletResponse(verb_response.replace(/&amp.*? /g, "'s "), true),
                                  {}
                                )
                              )
                            });
                          });
                        });
                      }
                      );
                    });
                  });
                });
              };
            }

            break;
          case "AMAZON.HelpIntent":
            context.succeed(
              generateResponse(
                buildSpeechletResponseWithReprompt("You can ask Happy Camper to find campgrounds around a certain city in California, ask if a camp site is pet friendly, or get details such as a campground description, available amenities, directions and nearby attractions. Try Saying, 'Tell me about Pine Point'. 'Can I take my dog to Black Rock?'. 'Find campgrounds around Joshua Tree'. 'How do I get to Emerald Bay?'. 'What is around Fish Creek?' or 'What are the available amenities at Upper Pines?'. What campground information would you like?",
                  false,
                  "Try Saying, 'Tell me about Pine Point'. 'Can I take my dog to Black Rock?'. 'Find campgrounds around Joshua Tree'. 'How do I get to Emerald Bay?'. 'What is around Fish Creek?'. 'What are the available amenities at Upper Pines?'. What campground information would you like?"),
                {}
              )
            )
            break;
          case "AMAZON.StopIntent":
            context.succeed(
              generateResponse(
                buildSpeechletResponse("Goodbye!", true),
                {}
              )
            )
            break;
          case "AMAZON.CancelIntent":
            context.succeed(
              generateResponse(
                buildSpeechletResponse("Goodbye!", true),
                {}
              )
            )
            break;

          default:
            context.succeed(
              generateResponse(
                buildSpeechletResponse("Sorry, I didn\'t get that.", true),
                {}
              )
            )
            throw "Invalid intent"
        } //case "IntentRequest":
        break;

    } //switch

  } // try      
  catch (error) { context.fail(`Exception: ${error}`) }
} //handler

// Helpers            
buildSpeechletResponse = (outputText, shouldEndSession) => {

  return {
    outputSpeech: {
      type: "PlainText",
      text: outputText
    },
    shouldEndSession: shouldEndSession
  }

}

generateResponse = (speechletResponse, sessionAttributes) => {

  return {
    version: "1.0",
    sessionAttributes: sessionAttributes,
    response: speechletResponse
  }
}

buildSpeechletResponseWithReprompt = (outputText, shouldEndSession, reprompt) => {

  return {
    outputSpeech: {
      type: "PlainText",
      text: outputText
    },
    shouldEndSession: shouldEndSession,
    reprompt: { 
      outputSpeech: {
        type: 'PlainText',
        text: reprompt
      }
    },
  }
}

function CampOk(campName) {
  var regex = new RegExp(campName.toLowerCase() + ".*?,", '');
  var response = regex.exec(campgrounds);

  if (response != null) {
    return response[0].slice(0, -1);
  }
  else { return "" };
}