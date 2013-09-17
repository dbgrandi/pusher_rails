module PusherRails
  class Engine < ::Rails::Engine
    # Enabling assets precompiling under rails 3.1+
    initializer :assets do |config|
      Rails.application.config.assets.paths << Rails.root.join('PusherRails', 'vendor', 'assets', 'swf')
      # Rails.application.config.assets.precompile += %w( alchemy/alchemy.js alchemy/alchemy.css alchemy/print.css )
    end
  end
end
