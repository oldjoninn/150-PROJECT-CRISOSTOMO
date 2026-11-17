
# nolint start


# load the simplex solver implementation
source("simplex.R")


# cors middleware
# --------------------------------------------------
# allow the react frontend to communicate with the
# plumber api even when they run on different ports
#
# handle preflight options requests before forwarding
# the request to the appropriate endpoint

#* @filter cors
function(req, res) {

  # allow requests from any origin
  res$setHeader("Access-Control-Allow-Origin", "*")

  # handle browser preflight requests
  if (req$REQUEST_METHOD == "OPTIONS") {

    # specify the supported http methods
    res$setHeader(
      "Access-Control-Allow-Methods",
      "POST, GET, OPTIONS"
    )

    # allow requests containing json content
    res$setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    )

    # return a successful response for preflight requests
    res$status <- 200

    return(list())
  }

  # continue processing the request through plumber
  plumber::forward()
}


# health check endpoint
# --------------------------------------------------
# simple endpoint used to verify whether the api
# server is running and responding correctly

#* @get /health
function() {

  # return the current api status
  list(ok = TRUE)
}


# solve endpoint
# --------------------------------------------------
# receives the power dispatch configuration from the
# react frontend and passes it to the simplex solver
# possible responses

#* @post /solve
#* @serializer json list(auto_unbox = TRUE, digits = NA)
function(req, res) {

  # retrieve the parsed json request body
  b <- req$body

  # execute the solver and catch unexpected errors
  out <- tryCatch(

    # pass the selected power groups and co2 settings
    # to the main solver function
    solve_request(
      b$groups,
      b$co2On,
      b$co2Cap
    ),

    # return a generic error message if the solver fails
    error = function(e) {
      list(
        status = "error",
        message = "The solver hit an unexpected problem. Please try again."
      )
    }
  )

  # use http 400 for invalid requests and solver errors
  if (out$status %in% c("invalid", "error")) {
    res$status <- 400
  }

  # return the solver result as json
  out
}

# nolint end
