const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

proxy.on('error', function(e) {
  console.log('___Proxy error___', e);
});

http.createServer(function(req, res) {
  const host = req.headers.host;
  res.write(host + req.url);
  res.end();
  // proxy.web(req, res, { target: 'http://mytarget.com:8080' });
}).listen(80, ()=>{
  console.log('Proxy listening on port 80');
});