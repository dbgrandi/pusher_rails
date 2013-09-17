module PusherRails
  class Engine < ::Rails::Engine
    config.assets.paths << Rails.root.join('vendor', 'assets', 'swf')
  end
end
