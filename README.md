# Cartography Plugin for OFS

A plugin for Oracle Field Service (OFS) that provides cartography and mapping functionality, including visualization of chambers, splices, wires, centrals, and loops on an interactive map.

## Features

- Interactive map visualization using Google Maps API
- Search by central or address
- Calculate failure points in wire networks
- Register chambers and splices with location data
- Display nearby infrastructure elements (chambers, wires, centrals, splices, loops)
- Real-time location tracking
- Activity coordinate integration

## Installation Instructions

### Dependencies

Project uses [NodeJS](https://nodejs.org), first of all you need to install it.

Project uses [Grunt](https://gruntjs.com/) as a task runner for building. Run the below command to install grunt command line interface:

    npm install -g grunt-cli

To install all required NPM dependencies, cd to the project root and run:

    npm install

### Building the Package

In order to build resources use the command:

    grunt

After build you will have the "/build" folder which contains plugin files and zip archive which you can upload on the "Forms & Plugins" screen in OFS.

#### Versioning

Every time you build the package, the version is updated automatically, so **don't forget to commit and push the `package.json`** to have the package storage and source repository synced.

Build updates the third number in version string along with timestamp, e.g. `178.0.X`, where X is updatable parts.

To update the first number, run the following manually:

    grunt bumpup:major

To update the second number, run this:

    grunt bumpup:minor

Please notice, that timestamp part will be lost in this case, so after manual version bump you should run build again.

## License

### Custom Code (MIT License)

The following files are licensed under the MIT License:

- `src/index.html`
- `src/main.js`
- `src/style.css`
- `src/icons/` (all SVG files)
- `src/kingfisher.svg`

### Oracle Plugin Framework (UPL License)

The following files are part of the Oracle Field Service plugin framework and are licensed under the Universal Permissive License (UPL), Version 1.0:

- `src/plugin.js`
- `src/plugin-service-worker.js`
- `src/plugin-service-worker-interface.js`
- `src/manifest.appcache`

See `LICENSE` for the full license text.

## Project Structure

```
src/
├── index.html              # Main HTML file (MIT)
├── main.js                 # Main application logic (MIT)
├── style.css               # Stylesheet (MIT)
├── icons/                  # SVG icons directory (MIT)
│   ├── central.svg
│   ├── chamber.svg
│   ├── current-location.svg
│   ├── location-pin.svg
│   ├── loop.svg
│   ├── node-nearby.svg
│   ├── node-reachable.svg
│   └── splice.svg
├── kingfisher.svg          # Logo (MIT)
├── plugin.js               # OFS plugin framework (UPL)
├── plugin-service-worker.js # Service worker (UPL)
├── plugin-service-worker-interface.js # Service worker interface (UPL)
└── manifest.appcache       # Cache manifest (UPL)
```

## Configuration

The plugin requires a backend API endpoint. The backend implementation can be found in the [geo-fastapi repository](https://github.com/amiguelsanchezv/geo-fastapi).

Update the `API_BASE_URL` constant in `src/main.js`:

```javascript
const API_BASE_URL = "http://localhost:8000/api";
```

You also need to configure your Google Maps API key in `src/main.js`:

```javascript
script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places&loading=async&callback=initializeMap';
```

## Usage

1. Build the plugin using `grunt`
2. Upload the generated zip file from the `/build` folder to OFS
3. Configure the plugin in the "Forms & Plugins" screen
4. The plugin will be available in the OFS mobile app and OFS web
