# lib/pusher_rails/rails_helpers.rb

module PusherRails
  module Helpers
    ## Return the script tag
    def pusher_cdn_include_tag(options = {})
      use_ssl = options.delete(:ssl) || false
      url     = use_ssl ? URL[:https] : URL[:http]
      javascript_include_tag url
    end
  end
end