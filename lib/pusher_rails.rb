module PusherRails
  class Engine < ::Rails::Engine
    Rails.application.config.assets.paths << Rails.root.join('vendor', 'assets', 'swf')
  end
end
