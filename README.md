# Подключение
Установите пакет с npm:
```js
npm install gulp-concat-list
```
# Как использовать
— Подключите модуль в gulpfile.js
```js
const concatList = require('gulp-concat-list');
```
— Создайте задачу
```js
gulp.task("scripts:jsl", function() {
  return vfs.src('./' + devDir + '/' + jsDevDir + '/*.jsl')
    .pipe(concatList("*.jsl", isDevelopment)
    .pipe(vfs.dest('./' + pubDir + '/' + jsPubDir))
})
```
— В папке со скриптами создайте файл .jsl со списком нужных скриптов
```
content:
  js1.js,
  js2.js,
  js3.js,
  js and space.js
```
# Аргументы функции
```js
    concatList([argument1, [argument2]])
```
argument1 (string) — расширение файла, по умолчанию ".jsl"

argument2 (boolean) — добавлять ли карту, по умолчанию false
# Параметры файла
```
folder: pack;     // — папка в которой хранятся файлы
name: all.js;     // — имя конечного файла
content:          // — список файлов
  js1.js,
//js2.js,         // — если какой-то файл не требуется подключать
//js3.js,         //   его можно просто закомментироват
  js and space.js // — в имени файла можно использовать пробелы
// поддерживаются строчные комментарии
/* а так же и
много строчные
*/
separator: \n     // — разделитель между файлами, по умолчанию \n
/* Кончынай файл можно обернуть в функцию
которая принимает глобальную переменную во внутренюю
В данном случае файл будет обернут так
(function($){
  content
})(jQuery)
*/
wrapfn: jQuery -> $
//sourceMap: false;// использовать ли карту
/* не рекомендуется так как это лучше принимать в аргументе
```
