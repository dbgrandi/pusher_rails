# lib/pusher_rails/railtie.rb

module PusherRails
  class Engine < ::Rails::Engine
  end

  class Railtie < Rails::Railtie
    initializer 'pusher_rails' do |app|
      ## Add the Rails Helpers
      ActiveSupport.on_load :action_view do
        include PusherRails::RailsHelpers
      end
    end
  end
end