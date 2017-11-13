const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy();

proxy.on('error', function(e) {
  console.log('___Proxy error___', e);
});

http.createServer(function(req, res) {
  res.write(req.url);
  res.end();
  // proxy.web(req, res, { target: 'http://mytarget.com:8080' });
}).listen(80, ()=>{
  console.log('Proxy listening on port 80');
});