Package.describe({
  summary: "Instantiate and call methods on objects on the server from the client.",
  version: "0.0.1",
  git: "https://github.com/numtel/serverobject.git"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.2.1');
  api.addFiles('serverobject.js');
  api.addFiles('serverobject-server.js', 'server');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('numtel:serverobject');
  api.use('test-helpers');
  api.addFiles('serverobject-tests.js');
});
