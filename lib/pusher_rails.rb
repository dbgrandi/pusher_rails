require "pusher_rails/version"
require "pusher_rails/railtie"
require "pusher_rails/helpers"

module PusherRails
  URL = {
    http:   "http://js.pusher.com/2.1/pusher.min.js",
    https:  "https://d3dy5gmtp8yhk7.cloudfront.net/2.1/pusher.min.js"
  }
end
