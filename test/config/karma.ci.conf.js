// Karma configuration
// http://karma-runner.github.io/0.12/config/configuration-file.html

module.exports = function(config) {
  'use strict';

  config.set({
    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // base path, that will be used to resolve files and exclude
    basePath: '',

    // testing framework to use (jasmine/mocha/qunit/...)
    // as well as any additional frameworks (requirejs/chai/sinon/...)
    frameworks: [
        'mocha',
        'chai',
        'sinon',
        'browserify'
    ],

    // list of files / patterns to load in the browser
      files: [
          '../../src/**/*.js',
          '../spec/unit/**/*.js'
      ],

    // list of files / patterns to exclude
    exclude: [
    ],

    // web server port
    port: 8080,

    browserify: {
      browserifyOptions: {
            debug: true
      },
      exclude: ['jquery', 'underscore'],
      transform: [
          [
              'babelify',
              {
                  'loose': 'all',
                  'sourceMaps': true,
                  'modules': 'common',
                  'optional': ['es7.decorators']
              }
          ],[
              'aliasify', 
              {
                  aliases: {
                      'backbone': 'exoskeleton'
                  },
                  global: true, // By default Aliasify only runs against your code (not node_modules). This flag tells it to remap third-party code too.
                  verbose: true
              }
          ]
      ]
    },

    preprocessors: {
      '../../src/**/*.js': 'browserify',
      '../spec/unit/**/*.js': 'browserify'
    },

    reporters: ['mocha'],

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: [
        "PhantomJS"
    ],

    // Which plugins to enable
    plugins: [
        "karma-phantomjs-launcher",
        "karma-mocha",
        "karma-chai",
        "karma-sinon",
        "karma-browserify",
        "karma-mocha-reporter"
    ],

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: true,

    colors: false,

    // level of logging
    // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: config.LOG_ERROR,

    // Uncomment the following lines if you are using grunt's server to run the tests
    // proxies: {
    //   '/': 'http://localhost:9000/'
    // },
    // URL root prevent conflicts with the site root
    // urlRoot: '_karma_'
  });
};
