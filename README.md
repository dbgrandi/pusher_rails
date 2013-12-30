[Pusher](https://pusher.com) for Rails 3.1+
=====================

Adds:
- [pusher-gem v0.11.3](https://github.com/pusher/pusher-gem/)
- [pusher.js v2.1.5](https://github.com/pusher/pusher-js/)
- [backpusher.js](https://github.com/pusher/backpusher)
- [underscore.js](http://underscorejs.org/) - Dependency for backpusher.js

This pulls in the *pusher-gem* as well as adding *pusher.js*, *backpusher.js* and *underscore.js* to the assets pipeline of your Rails 3.1+ app.

## Asset Pipeline Useage

Add this to your app/assets/javascripts/application.js:

    // if you want to use pusher.js
    //= require pusher

    // if you want to use pusher.min.js
    //= require pusher.min

    // if you are using pusher.js + backbone.js
    //= require backpusher
    //= require underscore

## New CDN Usage for Pusher

This is a new feature added to help keep up with patch revisions to the pusher.js library.  If you use the CDN helper provided,
your code will reference the latest 2.1.x version of the pusher.js library without you having to wait for this gem to update
on *every* revision.

##### Usage

Use this helper in your view templates.  The below example is in [SLIM](http://slim-lang.com/).

```ruby
doctype html
html
  head
    title My Awesome App
    = javascript_include_tag :application
    = pusher_cdn_include_tag
    = csrf_meta_tags
    ...
```

#### Options

The helper accepts one argument to switch between the HTTP & HTTPS CDN URLs.

**use_ssl** (true || false)

The default is false which renders the unsecure HTTP CDN URL.

```ruby
  = pusher_cdn_include_tag use_ssl: true
```

We are pointing to the [official Pusher CDN's](http://pusher.com/docs/client_libraries#js).

Licenses
========

    /*!
     * Pusher JavaScript Library v1.12.2
     * http://pusherapp.com/
     *
     * Copyright 2011, Pusher
     * Released under the MIT licence.
     */

    //     Backpusher.js 0.0.2
    //     (c) 2011-2012 Pusher.
    //     Backpusher may be freely distributed under the MIT license.
    //     For all details and documentation:
    //     http://github.com/pusher/backpusher