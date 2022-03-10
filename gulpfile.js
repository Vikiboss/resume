const fs = require('fs');
const path = require('path');

const gulp = require('gulp');
const jade = require('gulp-jade');
const copy = require('gulp-copy');
const sass = require('gulp-sass');
const connect = require('gulp-connect');
const ghPages = require('gulp-gh-pages');
const autoprefixer = require('gulp-autoprefixer');

const puppeteer = require('puppeteer');
const rimrafPromise = require('rimraf-promise');

gulp.task('resume-sass', (done) => {
  gulp
    .src('src/scss/resume.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({ browsers: ['last 4 versions'], cascade: false }))
    .pipe(gulp.dest('dist/css/'))
    .pipe(connect.reload());
  done();
});

gulp.task('icon-sass', (done) => {
  gulp
    .src('src/scss/iconfont.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({ browsers: ['last 4 versions'], cascade: false }))
    .pipe(gulp.dest('dist/iconfont/'))
    .pipe(connect.reload());
  done();
});

gulp.task('sass:watch', (done) => {
  gulp.watch('./src/scss/resume.scss', gulp.series('resume-sass'));
  gulp.watch('./src/scss/iconfont.scss', gulp.series('icon-sass'));
  gulp.watch('./src/scss/components/*.scss', gulp.series('resume-sass'));
  done();
});

gulp.task('json2jade', (done) => {
  const info = JSON.parse(fs.readFileSync('./info.json', 'utf-8'));
  const locals = highlight(info);
  gulp
    .src('./src/jade/index.jade')
    .pipe(jade({ locals }))
    .pipe(gulp.dest('./dist/'))
    .pipe(connect.reload());
  done();
});

gulp.task('json2jade:watch', (done) => {
  gulp.watch('./info.json', gulp.series('json2jade'));
  done();
});

function src2dist(dir) {
  return gulp.src(`./src/${dir}/*.*`).pipe(gulp.dest(`./dist/${dir}/`));
}

function highlight(locals) {
  var locals = JSON.stringify(locals);
  const re = /`(.+?)`/g;
  locals = locals.replace(re, '<strong>$1</strong>');
  return JSON.parse(locals);
}

gulp.task('copy', (done) => {
  src2dist('iconfont');
  src2dist('img');
  src2dist('pdf');
  gulp.src('./CNAME').pipe(gulp.dest('./dist'));
  done();
});

gulp.task('clean', (done) => {
  rimrafPromise('./dist/');
  done();
});

gulp.task('deploy', () =>
  gulp.src('./dist/**/*').pipe(
    ghPages({
      remoteUrl: 'git@github.com:lenconda/lenconda.github.io.git',
      branch: 'master',
    })
  )
);

let port = 9000;

// 避免打印时，同时运行开发服务报错
gulp.task('set-pdf-port', (done) => {
  port = 9001;
  done();
});

gulp.task('webserver', (done) => {
  connect.server({
    root: './dist',
    livereload: true,
    port,
  });
  done();
});

gulp.task('default', gulp.series('icon-sass', 'resume-sass', 'json2jade', 'copy'));

gulp.task('dev', gulp.series('default', 'json2jade:watch', 'sass:watch', 'webserver'));

gulp.task(
  'pdf',
  gulp.series('set-pdf-port', 'default', 'webserver', async (done) => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:9001');
    await delay(3000);

    const exportPath = path.join(__dirname, './dist/pdf/resume.pdf');

    fs.mkdir(path.join(__dirname, './dist/pdf'), () =>
      fs.writeFileSync(exportPath, '', { encoding: 'utf-8' })
    );

    await page.pdf({
      path: exportPath,
      width: '10in',
      height: '27in',
      printBackground: true,
      displayHeaderFooter: false,
      margin: {
        top: 0,
        left: 20,
        right: 20,
        bottom: 0,
      },
    });

    browser.close();
    connect.serverClose();
    done();
  })
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
