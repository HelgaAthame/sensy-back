// Заглушка вместо настоящего sharp. @xenova/transformers требует sharp только
// для обработки изображений (vision-модели), которые в этом проекте не
// используются — тут только аудио/ASR. Настоящий sharp тянет нативный
// libvips-бинарник, скачивание которого стабильно обрывается по таймауту
// при сборке Docker-образа на нашем канале, поэтому заменён через
// "overrides" в package.json на этот no-op.
function sharp() {
  throw new Error('sharp не установлен: обработка изображений в этом проекте не используется');
}

module.exports = sharp;
module.exports.default = sharp;
