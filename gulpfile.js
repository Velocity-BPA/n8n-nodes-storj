/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

const { src, dest, series } = require('gulp');
const path = require('path');

function copyIcons() {
  return src('nodes/**/*.{png,svg}')
    .pipe(dest('dist/nodes'));
}

function copyCredentialIcons() {
  return src('credentials/**/*.{png,svg}')
    .pipe(dest('dist/credentials'));
}

exports['build:icons'] = series(copyIcons, copyCredentialIcons);
exports.default = exports['build:icons'];
