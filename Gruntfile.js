module.exports = function (grunt) {
    'use strict';

    grunt.initConfig({
        browserify: {
            dist: {
                options: {
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
                files: { './dist/formell.js': ['./src/formell.js'] }
            }
        },
        watch: {
            scripts: {
                options: { spawn: false },
                files: ['./src/**/*.js'],
                tasks: ['browserify']
            }
        },
        karma: {
            unit: {
                configFile: './test/config/karma.conf.js',
                singleRun: false,
                autoWatch: true,
                browsers: ['Chrome']
            },
            continuous: {
                configFile: './test/config/karma.ci.conf.js',
                singleRun: true,
                browsers: ['PhantomJS']
            }
        },
        webdriver: {
            options: {
                desiredCapabilities: {
                    browserName: 'chrome'
                }
            },
            e2e: {
                tests: ['test/spec/e2e/**/*.js']
            },
            continuous: {
                options: {
                    desiredCapabilities: {
                        browserName: 'phantomjs'
                    }
                },
                tests: ['test/spec/e2e/**/*.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-webdriver');
    grunt.registerTask('default', [
        'browserify',
        'watch'
    ]);
    grunt.registerTask('build', ['browserify']);
    grunt.registerTask('unit-test', ['karma:unit']);
    grunt.registerTask('e2e-test', ['webdriver:e2e']);
};