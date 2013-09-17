module PusherRails
  class Engine < ::Rails::Engine
    # Enabling assets precompiling under rails 3.1+
    initializer :append_dependent_assets_path, group: :all do |app|
      app.config.assets.paths << 'vendor/assets/swf'
    end
  end
end
