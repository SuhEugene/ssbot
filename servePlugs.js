const express = require('express');
const serveIndex = require('serve-index');

const app = express();

app.use('/plugs', express.static('plugs'), serveIndex('plugs', { icons: true }));
app.listen(3000, () => {
  console.log('Serving plugs on 3000!');
});
