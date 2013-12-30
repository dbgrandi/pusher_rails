# lib/pusher_rails/rails_helpers.rb

module PusherRails
  module Helpers
    ## Return the script tag
    ##
    ## options
    ## =====================
    ## use_ssl (boolean)
    ##
    ## The CDN URL used for the include tag is determined by this option
    ##
    def pusher_cdn_include_tag(options = {})
      url     = (options[:use_ssl] || false) ? URL[:https] : URL[:http]
      javascript_include_tag url
    end
  end
end