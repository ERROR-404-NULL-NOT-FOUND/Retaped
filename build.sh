#!/bin/sh
error () {
  printf "!! ERROR: $1 !!"
  return 1
}
printf "Retaped minification build script.\nPlease note that this build script is NOT required to run Retaped, it's only used to make Retaped load faster on extremely slow internet connections\nRetaped is developed by Tetra Green and Lokicalimoto, and licenced under GPLv3 or later\n"

printf "=> Checking dependancy: uglifyjs"
if [ "$(type uglifyjs)" = "uglifyjs: not found" ]; then
  printf "You must install Uglify-js via `npm install -g uglify-js`\n"
  error "Unsatisfied dependancy"
fi
printf "OK\n"

printf "=> Checking dependancy: CSSO..."
if [ "$(type csso)" = "csso: not found" ]; then
  printf "You must install CSSO via `npm install -g csso-cli`\n"
  error "Unsatisfied dependancy"
fi
printf "OK\n"

printf "=> Checking dependancy: HTML-minifier..."
if [ "$(type html-minifier)" = "html-minifier: not found" ]; then
  printf "You must install HTML-minifier via `npm install -g html-minifier`\n"
  error "Unsatisfied dependancy"
fi
printf "OK\n"

printf "[[ Dependancies satisfied, building ]]\n"

if [ -d "./build" ]; then
  printf "Detected existing build directory\n"
  printf "=> Deleting build directory..."
  rm -r ./build 
  printf "OK\n"
fi
printf "=> Creating build directory..."
mkdir -p ./build/modules/style
printf "OK\n"

printf "=> Minifying src/index.html (outputting to ./build/index.html)..."
html-minifier --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true src/index.html > ./build/index.html
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc src/index.html | head -1)\n"
printf "  Minified size: $(du --apparent-size -shc build/index.html | head -1)\n"

printf "=> Minifying src/main.js (outputting to ./build/main.js)..."
uglifyjs --compress -- src/main.js > ./build/main.js
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc src/main.js | head -1)\n"
printf "  Minifid size: $(du --apparent-size -shc build/main.js | head -1)\n"

printf "=> Minifying src/emojis.json (outputting to ./build/emojis.json)..."
uglifyjs --compress --expression -- src/emojis.json > ./build/emojis.json
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc src/emojis.json | head -1)\n"
printf "  Minified size: $(du --apparent-size -shc build/emojis.json | head -1)\n"

printf "=> Minifying src/style.css (outputting to ./build/style.css)..."
csso src/style.css > ./build/style.css
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc src/style.css | head -1)\n"
printf "  Minified size: $(du --apparent-size -shc build/style.css | head -1)\n"

printf "=> Minifying src/modules/style/error.css (outputting to ./build/modules/style/error.css)..."
csso src/modules/style/error.css > ./build/modules/style/error.css
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc build/modules/style/error.css | head -1)\n"
printf "  Minified size: $(du --apparent-size -shc build/modules/style/error.css | head -1)\n"

printf "=> Minifying build/modules/style/button.css (outputting to build/modules/style/button.css)..."
csso src/modules/style/button.css > build/modules/style/button.css
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc src/modules/style/button.css | head -1)\n"
printf "  Minified size: $(du --apparent-size -shc build/modules/style/button.css | head -1)\n"

printf "=> Minifying src/modules/style/input.css (outputting to build/modules/style/input.css)..."
csso src/modules/style/input.css > build/modules/style/input.css
printf "OK\n"
printf "  OG Size: $(du --apparent-size -shc src/modules/style/input.css | head -1)\n"
printf "  Minified size: $(du --apparent-size -shc build/modules/style/input.css | head -1)\n"
printf "[[ Build finished! ]]\n"
printf "Total size of files: $(du --apparent-size -shc build | head -1 | sed "s/build//g")"
