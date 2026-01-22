"use strict";

module.exports = function (grunt) {

    const outputDir = 'build';
    const ARCHIVE_FOLDER = 'hosted';
    const ARCHIVE_FILE_NAME_TEMPLATE = '<%= pkg.name %>-<%= pkg.version %>-hosted.zip';
    const SOURCES_FOLDER_NAME_TEMPLATE = '<%= pkg.name %>-<%= pkg.version %>-sources';
    const SOURCES_FILE_NAME_TEMPLATE = '<%= pkg.name %>-<%= pkg.version %>-sources.zip';
    const PACKAGE_FILE_NAME_TEMPLATE = '<%= pkg.name %>-<%= pkg.version %>-package.zip';

    const SRC_FILES_PATTERNS = [
        './src/**',
        './test/**',
        './README.md',
        './*LICENSE*.txt',
        './package.json',
        './Gruntfile.js',
        '!./test/reporter-config.json',
        '!./test/run-unit-tests.sh',
        '!./test/run-tests.sh'
    ];

    grunt.registerTask('autoIncrementVersion', 'Auto increment package version on every build', () => {
        grunt.task.run('bumpup:patch:');
    });

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        bumpup: {
            options: {
                updateProps: {
                    pkg: 'package.json'
                }
            },
            files: ['package.json']
        },
        clean: {
            start: [outputDir + '/*'],
            finish: []
        },
        copy: {
            main: {
                expand: true,
                cwd: 'src',
                src: '**',
                dest: outputDir + '/' + ARCHIVE_FOLDER + '/',
                options: {
                    process: (content, srcPath) => {
                        return srcPath.match(/(.html|.js|.json)$/i)
                            ? content
                                .replace(/\{\*BUILD_VERSION\*\}/g, grunt.config.get('pkg.version'))
                                .replace(/\{\*ROOT_SERVICE_WORKER_VERSION\*\}/g, grunt.config.get('pkg.rootServiceWorkerVersion'))
                            : content;
                    }
                }
            },
            sources: {
                src: SRC_FILES_PATTERNS,
                dest: `${outputDir}/${SOURCES_FOLDER_NAME_TEMPLATE}/`
            },
            licenses : {
                src: ['./*LICENSE*.txt'],
                dest: outputDir + '/'
            },
            pluginManifest: {
                src: ['./manifest.json'],
                dest: outputDir + '/'
            },
        },
        zip: {
            hosted: {
                cwd: outputDir + '/' + ARCHIVE_FOLDER + '/',
                src: [outputDir + '/' + ARCHIVE_FOLDER + '/*.*'],
                dest: outputDir + '/' + ARCHIVE_FILE_NAME_TEMPLATE
            },
            sources: {
                cwd: outputDir + '/',
                src: [outputDir + '/' + SOURCES_FOLDER_NAME_TEMPLATE + '/**'],
                dest: outputDir + '/' + SOURCES_FILE_NAME_TEMPLATE
            },
            package: {
                cwd: outputDir + '/',
                src: [
                    outputDir + '/' + ARCHIVE_FILE_NAME_TEMPLATE,
                    outputDir + '/' + SOURCES_FILE_NAME_TEMPLATE,
                    outputDir + '/' + 'manifest.json',
                    outputDir + '/' + 'LICENSE.txt',
                    outputDir + '/' + 'THIRD_PARTY_LICENSES.txt',
                ],
                dest: outputDir + '/package/' + PACKAGE_FILE_NAME_TEMPLATE
            },
        },
    });

    grunt.loadNpmTasks('grunt-bumpup');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-zip');

    grunt.registerTask('build', [
        'clean:start',
        'autoIncrementVersion',
        'copy:main',
        'copy:sources',
        'copy:licenses',
        'clean:finish',
        'zip:hosted',
        'zip:sources',
    ]);

    grunt.registerTask('package', [
        'clean:start',
        'copy',
        'clean:finish',
        'zip',
    ]);

    grunt.registerTask('default', ['build']);
};
