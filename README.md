[Pusher](https://pusher.com) for Rails 3.1+
=====================

Adds:
- [pusher-gem v0.8.2](https://github.com/pusher/pusher-gem/tree/v0.8.2)
- [pusher.js v1.9.1](https://github.com/pusher/pusher-js/tree/v1.9.1)
- [backpusher.js](https://github.com/pusher/backpusher/commit/e61c9d7a761fcb48f312416408d1bf4ed418735b#diff-1)

This pulls in the *pusher-gem* as well as adding *pusher.js* and *backpusher.js* to the assets pipeline of your rails 3.1 app.

Add this to your app/assets/javascripts/application.js:

    // if you want to use pusher.js
    //= require pusher

    // if you are using pusher.js + backbone.js
    //= require backpusher


Licenses
========

    /*
     * Pusher JavaScript Library v1.9.1
     * http://pusherapp.com/
     *
     * Copyright 2011, Pusher
     * Released under the MIT licence.
     */
 
     //     Backpusher.js 0.0.1
     //     (c) 2011 Pusher.
     //     Backpusher may be freely distributed under the MIT license.
     //     For all details and documentation:
     //     http://github.com/pusher/backpusher
 