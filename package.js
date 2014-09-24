Package.describe({
  summary: "Create proxy objects on the client for even easier server integration.",
  version: "0.0.7",
  git: "https://github.com/numtel/serverobject.git"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.2.1');
  api.addFiles('serverobject.js');
  api.export('ServerObject');
  api.export('ServerObjectCallbacks');
  api.addFiles('serverobject-server.js', 'server');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('test-helpers');
  api.addFiles('serverobject.js');
  api.export('ServerObject');
  api.export('ServerObjectCallbacks');
  api.addFiles('serverobject-server.js', 'server');
  api.addFiles('serverobject-tests.js');
});
