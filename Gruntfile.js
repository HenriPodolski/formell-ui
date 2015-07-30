module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-karma');
    grunt.initConfig({
        browserify: {
            dist: {
                options: {
                    transform: [[
                            'babelify',
                            {
                                'loose': 'all',
                                'sourceMaps': true,
                                'modules': 'common',
                                'optional': ['runtime']
                            }
                        ]]
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
            'unit': {
                'options': {
                    'autoWatch': false,
                    'browsers': ['PhantomJS'],
                    'configFile': './test/karma.conf.js',
                    'singleRun': true
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.registerTask('default', [
        'browserify',
        'watch'
    ]);
    grunt.registerTask('build', ['browserify']);
    grunt.registerTask('test', ['karma']);
};