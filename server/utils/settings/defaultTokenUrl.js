/*
  The address a link in an email is made from until the site's own is set (the verification_url and password_reset_url
  settings): this server, on the port it runs on, so a new site's links open the site it is running.
*/
export default path => `http://localhost:${process.env.PORT || 3000}/${path}/{{token}}`;
