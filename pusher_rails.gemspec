# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'pusher_rails/version'

Gem::Specification.new do |spec|
  spec.name          = "pusher_rails"
  spec.version       = PusherRails::VERSION
  spec.authors       = ["David Grandinetti", "JD Hendrickson"]
  spec.email         = ["dave@wegoto12.com", "jd@digitalopera.com"]
  spec.description   = "Adds pusher.js/backpusher.js to the asset pipeline and pusher-gem to to your app."
  spec.summary       = "Pusher integration for Rails 3.1+"
  spec.homepage      = "https://github.com/dbgrandi/pusher_rails"
  spec.license       = "MIT"

  spec.files         = `git ls-files`.split($/)
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ["lib"]

  ## Development Dependencies -----------------------------
  spec.add_development_dependency "bundler", "~> 1.3"
  spec.add_development_dependency "rake"

  ## Production Dependencies ------------------------------
  spec.add_dependency "pusher", "~> 0.11.3"
end
