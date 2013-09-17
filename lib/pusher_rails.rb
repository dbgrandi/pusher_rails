module PusherRails
  class Engine < ::Rails::Engine
    # Enabling assets precompiling under rails 3.1+
    initializer :assets do |config|
      config.assets.paths << Rails.root.join('PusherRails', 'vendor', 'assets', 'swf')
    end
  end
end
