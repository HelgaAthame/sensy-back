# План разработки бэкенда Sensy

> Источник истины: фронтенд `sensy_front` (GitLab `sensy1/sensy_front`), ветка `dev` (самая свежая, коммит `efc2898`, 14.08.2025). Прежний бэкенд утерян безвозвратно, поэтому весь контракт API реконструирован из RTK Query слоя фронта (`src/entities/*/**.api.ts`, `*.types.ts`).

## 1. Что за продукт

Система контроля качества звонков колл-центра:
- загрузка/приём аудиозаписей звонков с метаданными (оператор, проект, клиент, дата);
- расшифровка речи (STT) с разбивкой по каналам (оператор/клиент);
- анализ тональности (негатив), пауз и перебиваний;
- поиск ключевых слов/фраз по настраиваемым словарям;
- чек-листы оценки качества разговора (ручные + автозаполнение через GPT);
- аналитический дашборд с агрегатами по операторам/периодам;
- уведомления (алерты/нотификации) в шапке;
- авторизация по email/паролю (JWT).

## 2. Сущности

| Сущность | Назначение |
|---|---|
| `MediaFile` | звонок/аудиозапись + результаты анализа |
| `Operator` | оператор колл-центра |
| `Project` | проект/линия, к которой привязаны звонки, словари, чек-листы |
| `Checklist` | шаблон критериев оценки (блоки → критерии, шкала Full/Binary) |
| `Dictionary` (Vocabulary) | словарь фраз (Общий/Для оператора/Для клиента/Термины) для поиска по звонку |
| `ChatMessage` | уведомление/алерт (два типа ленты) |
| `User` | учётка для входа (email/password → JWT) |

Многие сущности связаны many-to-many через проект: `checklistProjects`, `vocabularyProjects`.

## 3. Полный инвентарь эндпоинтов (реконструирован из фронта)

Базовый URL берётся из `NEXT_PUBLIC_BASE_API_URL` (сейчас `http://86.57.195.162:5187/` — сервер недоступен). Все пути ниже — относительные, без ведущего `/`.

### Auth
| Метод | Путь | Body/Params | Ответ | Файл фронта |
|---|---|---|---|---|
| POST | `auth/signin` | `{ email, password }` | `{ accessToken }` | `entities/auth/auth.api.ts` |

Авторизация далее — `Authorization: Bearer <accessToken>` на каждый запрос (JWT хранится в `localStorage`). Дополнительно `fetchBaseQuery` шлёт `credentials: 'include'` (куки) — используется не будет, убираем при доработке фронта.

**Решено**: refresh-токен и `logout` не делаем — для MVP простой долгоживущий JWT (TTL порядка нескольких недель), как сейчас и реализовано на фронте (токен живёт до 401, разлогин только через очистку `localStorage`).

### MediaFile (звонки)
| Метод | Путь | Params/Body | Ответ | Заметки |
|---|---|---|---|---|
| POST | `api/mediafile` | multipart `file` + query `createDate, clientNumber, operatorId, projectId` | `MediaFileResponse` (**решено**: было `[]`-массив на один файл — нелогично, меняем на одиночный объект и правим вызов на фронте) | создаёт запись со статусом "в обработке", ML-пайплайн запускается асинхронно |
| GET | `api/v2/mediafile` | query: `start, end, offset, limit, operatorId, searchPhrase, orderByDescOperatorName, orderByDescCreateDate, orderByDescClientNumber, orderByDescDuration, orderByDescNegativeLevel, orderByDescPhrasesCount, orderByDescMaxSimultaneousSilence, orderByDescSimultaneousSpeechCount, filterByPhrasesCategoriesCommaSeparated` | `{ totalCount, mediaFile: MediaFile[] }` | список с пагинацией offset/limit и булевыми флагами сортировки по каждому полю |
| GET | `api/mediafile/{id}` | — | `MediaFile` | карточка звонка |
| GET | `api/mediafile/{id}/stream` | — | audio bytes | требует `Authorization` заголовок (фронт вручную делает `fetch`+`blob`, не полагается на cookie) |
| GET | `api/mediafile/{id}/result` | query: `negativeProbThreshold, simultaneousSilenceDurationThreshold` | `MediaFileResultResponse` (stt/tonal/simultaneousSpeech/simultaneousSilence/keywordsSearchResult/gptSummary/gptChecklist) | результаты анализа; пороги передаются с фронта, значит бэк хранит сырые оценки/вероятности и фильтрует на лету |
| PUT | `api/mediafile/{id}` | query `checklistId`, body `{ blocks: [{ name, criterias: [{ name, minScore, maxScore, help, scale }] }] }` | — | сохранение/обновление применённого к звонку чек-листа |
| GET | `api/download/mediafile/excel` | те же query-параметры, что у списка (**решено**: на фронте сейчас фильтры не передаются — это баг, добавляем параметры и на бэке, и в вызове фронта) | blob `.xlsx` | экспорт списка звонков |
| POST | `api/mediafile/{id}/gpt-analysis` (**новый эндпоинт**, нужно добавить на фронт) | — | `202 Accepted`, запускает фоновую генерацию `gptSummary`/`gptChecklist` | **решено**: GPT-анализ считается лениво, по требованию — триггерится при первом открытии карточки звонка (фронт вызывает этот эндпоинт, если `gptSummary`/`gptChecklist` ещё `null` в ответе `result`), а не сразу в пайплайне загрузки |

`MediaFile` включает: `fileName, numChannels, sampleRate, duration, operatorId/Name, createDate, lastAccessUtc, isFailed, additionalMetadata{outerId, clientId, clientNumber, direction}, summaryAnalyserResult{...агрегаты по негативу/паузам/перебиваниям/ключевым словам...}, gptSummary, gptChecklist, projectName`.

### Operators
| Метод | Путь | Body | Ответ |
|---|---|---|---|
| GET | `api/operator` | — | `Operator[]` |
| GET | `api/operator/{id}` | — | `Operator` |
| POST | `api/operator` | `Partial<Operator>` | — |
| PUT | `api/operator/{id}` | `Partial<Operator>` | — |

### Projects
| Метод | Путь | Body | Ответ |
|---|---|---|---|
| GET | `api/project` | — | `Project[]` |
| GET | `api/project/{id}` | — | `Project` |
| POST | `api/project` | `Partial<Project>` | — |
| PUT | `api/project/{id}` | `Partial<Project>` | — |

`Project` содержит связки `vocabularyProjects[]` и `checklistProjects[]` — то есть словари и чек-листы привязываются к проекту (эндпоинтов для управления самой связкой отдельно нет — вероятно, задаётся через `projectIds` при создании/обновлении чек-листа/словаря).

### Checklists
| Метод | Путь | Body | Ответ |
|---|---|---|---|
| GET | `api/checklist` | — | `Checklist[]` |
| GET | `api/checklist/{id}` | — | `ChecklistFull` (+ `checklistProjects`) |
| POST | `api/checklist` | `{ name, projectIds }` | — |
| PUT | `api/checklist/{id}` | `Partial<ChecklistReqBody>` (`isActive, name, projectIds, data:{name, blocks:[{name, criterias:[{name, minScore, maxScore, help, scale}]}]}`) | — |
| POST | `api/checklist/{id}` | — (тело не шлётся) | — | клонирование чек-листа (`cloneChecklist`) |

Шкала критерия: `Full` (числовая) или `Binary` (да/нет).

### Dictionaries (Vocabulary)
| Метод | Путь | Body | Ответ |
|---|---|---|---|
| GET | `api/vocabulary` | — | `Dictionary[]` |
| GET | `api/vocabulary/{id}` | — | `Dictionary` |
| POST | `api/vocabulary` | `{ name, isActive, type, colorHex, phrases }` | — |
| PUT | `api/vocabulary/{id}` | то же | — |

`type`: `All | OnlyOperator | OnlyClient | Hotwords`. `colorHex` — из фиксированной палитры (`shared/constants/dictionaryColors`).

### Analytics
| Метод | Путь | Params | Ответ |
|---|---|---|---|
| GET | `api/v2/dashboard` | `start, end, offset, limit, operatorId, topNKeywords, negativeLevelThreshold, filterByPhrasesCategoriesCommaSeparated` | `{ keywordsFrequencyData, messageText, plotData[], negativeHistogramData, summaryData, operatorRatingData[] }` |

`filterByPhrasesCategoriesCommaSeparated` — это CSV айдишников словарей (см. `analytics-filter-modal.tsx`, чекбоксы = список словарей).

### Chat / Notifications
| Метод | Путь | Params | Ответ | Поллинг на фронте |
|---|---|---|---|---|
| GET | `api/chat/{chatType}/message` | `chatType: Notification\|Alert`, `start, end, offset, limit` | `ChatMessage[]` (`id, chatId, createDate, text, attachmentsCount, seen`) | `Notification` — раз в час, `Alert` — раз в минуту |
| POST | `api/chat/{chatType}/message` (**новый эндпоинт**, для ручного создания) | `{ text }` | `ChatMessage` | ручное создание уведомления администратором |

Реалтайма (WebSocket/SSE) в контракте нет — обычный поллинг через RTK Query.

**Решено**: источник сообщений — и то, и другое:
- **системные триггеры** внутри пайплайна/сервисов, создающие `ChatMessage` автоматически;
- **ручной CRUD** (см. новый эндпоинт выше) — на будущее для административных объявлений.

**Формулировки системных триггеров (зафиксировано):**

| # | Событие | `chatType` | Текст (`ChatMessage.text`) |
|---|---|---|---|
| 1 | Обработка записи упала с ошибкой (`isFailed = true`) | `Alert` | `Обработка записи «{fileName}» завершилась с ошибкой` |
| 2 | В звонке обнаружен высокий уровень негатива (выше настраиваемого порога) | `Alert` | `Высокий уровень негатива в звонке оператора {operatorName} от {createDate}` |
| 3 | GPT-анализ (саммари/чек-лист) завершился с ошибкой | `Alert` | `Не удалось сформировать GPT-анализ для записи «{fileName}»` |
| 4 | Запись успешно обработана и готова к просмотру | `Notification` | `Запись «{fileName}» обработана и готова к просмотру` |
| 5 | GPT-анализ по запросу успешно завершён | `Notification` | `GPT-саммари и чек-лист для записи «{fileName}» готовы` |
| 6 | Экспорт в Excel сформирован (если экспорт станет асинхронным при росте объёма) | `Notification` | `Экспорт звонков в Excel готов к скачиванию` |

Правило разделения: `Alert` — то, что требует внимания/может быть проблемой (ошибка, аномалия), опрашивается фронтом раз в минуту; `Notification` — рутинные информационные события об успешном завершении, опрашивается раз в час. `{fileName}`, `{operatorName}`, `{createDate}` — подстановки из соответствующей записи `MediaFile`.

## 4. Сквозные технические требования

- **Пагинация**: паттерн `offset/limit` + ответ `{ totalCount, items }`. Придерживаться его во всех списковых эндпоинтах.
- **Сортировка**: нестандартная — булевы флаги `orderByDescXxx` на каждое поле, а не `sortBy/sortDir`. Либо повторить as-is (проще всего для совместимости), либо — если фронт можно доработать — заменить на нормальный `sort=field&dir=asc`. Рекомендация: на бэке сделать нормальный enum-сортировщик внутри, а на входе принимать текущие флаги как временный адаптер.
- **Фильтры дат**: `start/end` строками (ISO, судя по `date-fns`/`date-fns-tz` в зависимостях фронта).
- **Файлы**: `multipart/form-data` для загрузки, потоковая отдача с обязательной проверкой `Authorization` заголовка (не только cookie) для `/stream`.
- **Ошибки**: фронт различает только `401` (разлогин + редирект) и `400` (просто логируется в консоль, без парсинга структуры). Остальные коды не обрабатываются специально — но лучше сразу закладывать единый JSON-формат ошибки (`{ message, code, details? }`) для будущего.
- **Тайм-зоны**: `formatDateWithLocalTimeZone` на фронте — даты уходят с оффсетом, бэку не полагаться на UTC "по умолчанию" без парсинга оффсета.

## 5. Асинхронный пайплайн обработки звонка (что нужно реализовать)

1. Приём файла → сохранение (диск/объектное хранилище) → запись `MediaFile` со статусом "в обработке".
2. Извлечение метаданных (`numChannels`, `sampleRate`, `duration`) — ffmpeg/ffprobe.
3. STT по каждому каналу отдельно, с тайм-кодами и посимвольными смещениями (`Stt.chunks[]`).
4. Детект тональности/негатива по аудио — по каналам, с сырыми `prob` (порог применяется на чтении, не на записи).
5. VAD по каналам → построение `simultaneousSpeech` (перебивания) и `simultaneousSilence` (паузы) через сравнение таймлайнов.
6. Поиск фраз из активных словарей проекта по тексту транскрипта → `keywordsSearchResult` с маппингом обратно во время через смещения символов STT-чанков.
7. Агрегация всего в `summaryAnalyserResult` для списка/аналитики (чтобы не гонять полный результат на каждый рендер таблицы).
8. `isFailed = true`, если любой из шагов упал — это отдельное булево поле, которое видит фронт.
9. `gptSummary`/`gptChecklist` в основной пайплайн загрузки **не входят** (решено — генерируются лениво). Их считает отдельный джоб, запускаемый эндпоинтом `POST api/mediafile/{id}/gpt-analysis` при первом открытии карточки звонка на фронте.

## 6. Стек: фреймворки, библиотеки, БД

**Зафиксировано по решению команды**: Node.js + NestJS + TypeScript, все компоненты — бесплатные/open-source, без платных SaaS API (никакого OpenAI API, Yandex SpeechKit и т.п. — только self-hosted модели с открытыми весами).

| Слой | Выбор | Зачем | Лицензия/стоимость |
|---|---|---|---|
| Web-framework | **NestJS (TypeScript)** | структура из коробки (модули/DI), совпадает с предпочтением команды, легко шарить типы с фронтом | MIT, бесплатно |
| ORM/миграции | **Prisma** | лучшая TS-типизация из коробки, миграции, схема как единый source of truth | MIT, бесплатно |
| БД | **PostgreSQL** | реляционная модель ложится на схему (M2M проект↔чек-лист↔словарь), `jsonb` для вложенных результатов анализа | open-source, self-hosted — бесплатно |
| Очередь фоновых задач | **BullMQ + Redis** | пайплайн обработки звонка — классический background job (upload → цепочка шагов → результат), нативно на TS | open-source, self-hosted — бесплатно |
| Хранилище файлов | **MinIO** (self-hosted, S3-совместимый) либо просто том на диске для старта | звонки — блобы, в БД не место | open-source, self-hosted — бесплатно |
| Аутентификация | **@nestjs/jwt + passport-jwt + bcrypt** | под контракт `signin` → `accessToken`; см. открытый вопрос про refresh-токен | бесплатно |
| STT (распознавание речи) | **Whisper через `@xenova/transformers`** (transformers.js, ONNX-инференс прямо в Node, без Python) — модель `whisper-small`/`whisper-base` в зависимости от нагрузки на CPU | веса модели открытые (MIT/Apache), работает локально — бесплатно, но нужен CPU/GPU-ресурс (см. открытый вопрос) |
| VAD (детект речи/пауз) | **`@ricky0123/vad-node`** (Silero VAD, ONNX) либо биндинг WebRTC VAD | лёгкая, точная, без GPU | open-source, бесплатно |
| Эмоции/тональность | **Фаза 3, реализовано.** `onnx-community/wav2vec2-base-Speech_Emotion_Recognition-ONNX` через `@xenova/transformers` (`audio-classification` pipeline, тот же движок, что и Whisper) | 6 классов эмоций (SAD/ANGRY/DISGUST/FEAR → негатив, HAPPY/NEUTRAL → нет), классификация по чанкам STT | бесплатно; модель англоязычная (акустическая, не текстовая) — готовой ONNX-модели под русскую речь, совместимой с transformers.js, на момент реализации нет |
| GPT-функции (саммари/чек-лист) | **Решено (обновлено): Groq API**, а не self-hosted Ollama | причина смены решения: Render free tier (512MB RAM) физически не тянет даже квантованную 7B-модель — Ollama потребовала бы переезда всего бэка на отдельный сервер (Oracle Cloud Always Free и т.п.), это отдельная миграция. У пользователя есть аккаунт Groq с бесплатным лимитом использования — проще и без переезда с Render | у Groq есть бесплатный лимит запросов, но это платный SaaS API по своей природе (лимит может закончиться при росте нагрузки) — единственное осознанное отступление от принципа "всё self-hosted/бесплатно" в проекте, принятое ради практичности деплоя |
| Excel-экспорт | **exceljs** | генерация `.xlsx` в Node | MIT, бесплатно |
| API-документация | **`@nestjs/swagger`** | автогенерация OpenAPI-спеки прямо из decorators/DTO контроллеров NestJS, живой Swagger UI на `/api/docs` без ручного поддержания отдельного файла | MIT, бесплатно |
| Тесты | **Jest + supertest** | стандарт NestJS | бесплатно |
| Контейнеризация | **Docker + docker-compose** (api, worker, postgres, redis, minio) | всё поднимается на своём сервере, без облачных подписок | бесплатно (кроме самого сервера) |

**Важная оговорка про "бесплатно"**: софт везде open-source и без подписок — это действительно бесплатно. Но self-hosted ML (Whisper, эмоции, LLM для GPT-функций) всё равно требует вычислительных мощностей (CPU минимум, GPU желательно для приемлемой скорости и качества LLM). Деньги, которые раньше уходили на платный API, теперь превращаются в требования к железу сервера.

### Требования к железу — с учётом реального объёма (~10 звонков/день)

**Решено**: ожидаемая нагрузка — до 10 звонков в день. При таком объёме GPU не нужен вообще, CPU справляется с большим запасом.

Расчёт: даже пессимистично (Whisper CPU в 3-5× медленнее реального времени, 2 канала обрабатываются последовательно) один звонок на 5-10 минут разговора обрабатывается до ~1 часа на CPU целиком (STT + VAD + поиск по словарям + эмоции). 10 звонков × 1 час = 10 часов компьютерного времени из 24 доступных в сутки — очередь никогда не накапливается, запас по времени больше чем 2×. GPT-анализ по запросу (не на каждый звонок сразу) добавляет лишь единицы минут при открытии конкретной карточки.

| Компонент | Достаточно для ~10 звонков/день |
|---|---|
| API (NestJS) + Postgres + Redis + MinIO | 2-4 vCPU, 4-8 GB RAM, SSD от 50 GB — этого хватает с запасом |
| STT (Whisper `whisper-small` через transformers.js) | CPU-only, без GPU. Обработка одного звонка — минуты-десятки минут, приемлемо, т.к. это фоновая задача, а не realtime |
| Эмоции (SER) | CPU-only, без GPU |
| LLM для GPT-функций (Ollama, модель 3-7B, напр. Qwen2.5-7B в квантованном виде) | CPU-only тоже реалистичен при таком редком вызове (по требованию, не на каждый звонок) — на 7B-модели ответ может занять десятки секунд-пару минут на CPU, это не проблема, если генерация асинхронная с индикатором загрузки на фронте |

**Вывод**: GPU — не требование, а опциональное ускорение впрок на случай сильного роста объёма звонков. На старте закупать/арендовать GPU не нужно — это меняет рекомендацию по деплою (см. раздел 10).

## 7. Эскиз схемы БД (PostgreSQL)

```
users            (id, email, password_hash, created_at)
operators        (id, name)
projects         (id, name, is_active)
dictionaries     (id, name, is_active, type, color_hex, phrases jsonb)
dictionary_projects (dictionary_id, project_id)          -- M2M
checklists       (id, name, is_active, data jsonb)        -- data: {name, blocks:[{name, criterias:[...]}]}
checklist_projects  (checklist_id, project_id)             -- M2M
media_files      (id, file_name, storage_path, num_channels, sample_rate,
                   duration, operator_id, project_id, create_date, last_access_utc,
                   is_failed, additional_metadata jsonb, status,
                   client_number, outer_id, client_id, direction)
media_file_results (media_file_id PK/FK, stt jsonb, tonal jsonb,
                   simultaneous_speech jsonb, simultaneous_silence jsonb,
                   keywords_search_result jsonb, gpt_summary text, gpt_checklist jsonb)
media_file_checklist (media_file_id, checklist_id, data jsonb)  -- применённый к звонку чек-лист
chat_messages    (id, chat_type enum(Notification,Alert), chat_id, create_date, text, attachments_count, seen)
```

`jsonb` для результатов анализа — осознанный выбор: структура (`stt.chunks[].regions[]` и т.д.) вложенная и не требует реляционных запросов по отдельным регионам, а `summaryAnalyserResult`/агрегаты для списка стоит держать денормализованными отдельными колонками для быстрой сортировки/фильтрации (`negative_level_overall`, `keywords_count`, `max_simultaneous_silence_duration` и т.п. — это как раз то, по чему сортирует `GET api/v2/mediafile`).

## 8. Открытые вопросы

Решено (зафиксировано, правим фронт при необходимости, не спрашиваем повторно):
- ~~`POST api/mediafile` возвращает массив на один файл~~ → меняем на одиночный объект.
- ~~Excel-экспорт без фильтров~~ → добавляем те же параметры, что у списка.
- ~~`credentials: 'include'` без явного использования куки~~ → убираем, оставляем только Bearer JWT.
- ~~Когда считать GPT-саммари/чек-лист~~ → лениво, по требованию (новый эндпоинт `POST api/mediafile/{id}/gpt-analysis`).
- ~~Источник Chat-уведомлений~~ → и системные триггеры, и ручной CRUD (новый эндпоинт `POST api/chat/{chatType}/message`).
- ~~Refresh-токен/logout~~ → не делаем, простой долгоживущий JWT.
- ~~Ожидаемая нагрузка~~ → до 10 звонков/день. Вывод: GPU не требуется, CPU-only сервер справляется с большим запасом (раздел 6), деплой можно делать в бесплатном/дешёвом варианте без гибридной GPU-схемы (раздел 10).
- ~~Формулировки системных алертов~~ → зафиксированы, см. таблицу в разделе 3 (Chat/Notifications).
- ~~Self-hosted Ollama vs Groq API для GPT-функций~~ → **Groq API** (см. раздел 6). Причина: Render free tier не тянет Ollama по памяти, а переезд ради этого — отдельная большая задача; у пользователя есть Groq с бесплатным лимитом. Единственное отступление от "всё self-hosted".

Открытых вопросов не осталось — план готов к реализации.

## 9. Этапы реализации

**Фаза 0 — каркас. ✅ Выполнено.** Проект (NestJS/Docker/Postgres/Prisma), auth (`signin`, простой JWT), CRUD `operators`, `projects`, `dictionaries`, `checklists`, подключённый `@nestjs/swagger` (OpenAPI-спека + Swagger UI на все эндпоинты с первого дня, растёт вместе с контроллерами) — без ML. Разблокирует справочные страницы фронта. Задеплоено на Render + Neon.

**Фаза 1 — приём звонков. ✅ Выполнено.** Загрузка файла (одиночный объект в ответе, см. решённые вопросы) + хранилище (MinIO локально / Backblaze B2 в проде) + метаданные (ffprobe) + список `GET api/v2/mediafile` с пагинацией/фильтрами/сортировкой (без результатов анализа) + очередь на BullMQ/Redis. Разблокирует `/calls`, `/uploading-record`. Задеплоено и проверено в проде.

**Фаза 2 — базовый анализ. ✅ Выполнено.** STT (Whisper `whisper-tiny` через `@xenova/transformers`) по каналам + keyword search по словарям. Разблокирует транскрипт и часть карточки звонка.
- **Отклонение от исходного плана**: вместо отдельной VAD-модели (`@ricky0123/vad-node`) `simultaneousSpeech`/`simultaneousSilence` вычисляются напрямую из тайм-кодов чанков Whisper (`return_timestamps: true`) через пересечение/дополнение интервалов по каналам — тайм-коды STT и есть речевые интервалы, отдельный VAD-проход был бы избыточен. Проще, меньше зависимостей, тот же результат для целей продукта.
- **Известный пробел**: BullMQ/Redis на Render (продакшен) пока не настроен — звонок загружается и сохраняется, но анализ не запускается. Нужен бесплатный Redis в проде (кандидат — Upstash free tier) по аналогии с тем, как раньше был закрыт похожий пробел с S3-хранилищем через Backblaze B2.
- **Найденный и исправленный критичный баг**: изначальная защита (try/catch вокруг постановки задачи в очередь) не работала, как задумано — при недоступном Redis `ioredis` по умолчанию переподключается бесконечно, и промис `analysisQueue.add(...)` никогда не отклоняется, а просто зависает — try/catch не срабатывает, потому что нет ошибки, есть вечное ожидание. Из-за этого на Render `POST api/mediafile` не отвечал вообще (не 4xx/5xx — полное зависание запроса), то есть загрузка звонков была сломана целиком, а не только фоновый анализ. Дополнительно поток стектреков на каждую попытку реконнекта сам по себе тормозил event loop. Исправлено: жёсткий таймаут (5с) поверх постановки в очередь + редкий бэкофф на переподключение (до 30с) и собственный throttled-обработчик ошибок вместо дефолтного логирования полного стека на каждую попытку. Проверено локально docker compose с намеренно остановленным Redis.
- Собрано и проверено локально через `docker compose` на тестовом WAV-файле сквозь весь цикл: загрузка → статус `Ready` → `GET api/mediafile/{id}/result` с непустыми `stt`/`simultaneousSpeech`/`simultaneousSilence`/`keywordsSearchResult`.
- Попутный фикс инфраструктуры: рантайм Docker-образа переведён с `node:22-alpine` на `node:22-slim` — прекомпилированный `onnxruntime-node` (транзитивная зависимость `@xenova/transformers`) собран под glibc и не грузится на musl (Alpine).

**Фаза 3 — тональность и аналитика. ✅ Выполнено.** Эмоции/негатив по аудио (`onnx-community/wav2vec2-base-Speech_Emotion_Recognition-ONNX`) по чанкам STT, полный расчёт `summaryAnalyserResult` (включая ранее заглушенные поля из Фазы 2 — счётчики/средние по simultaneousSpeech/Silence, разбивка по оператору/клиенту по конвенции канал 0/1), `GET api/v2/dashboard` (summaryData/plotData/negativeHistogramData/operatorRatingData/keywordsFrequencyData). Проверено локально и на проде.

**Фаза 4 — GPT-функции.** Groq API (см. раздел 6 — решение обновлено, не self-hosted Ollama; уточнение: сервис называется **Groq**, не Grok от xAI — легко перепутать по названию). Токен `GROQ_API_KEY` уже получен от пользователя и сохранён в `.env` (гитигнорится). Эндпоинт `POST api/mediafile/{id}/gpt-analysis` (ленивый триггер), применение чек-листа к звонку (`PUT api/mediafile/{id}`).

**Фаза 5 — довески.** Excel-экспорт с фильтрами, чат/уведомления (системные триггеры + ручной CRUD), полировка ошибок/статусов, нагрузочное тестирование пайплайна на реальном железе.

Реализацию имеет смысл вести так, чтобы после каждой фазы соответствующие страницы фронта переставали быть "мёртвыми" (сейчас фронт полностью готов и ждёт только бэк).

## 10. Деплой: бесплатно и платно

Программная часть везде open-source (раздел 6) — с лицензиями проблем нет. При объёме ~10 звонков/день (раздел 6) GPU не нужен, всё считается на CPU с большим запасом — это сильно упрощает деплой: не нужна гибридная схема с почасовой арендой видеокарты, достаточно **одного обычного сервера**.

### Бесплатный вариант — при таком объёме полностью рабочий, не просто "теоретически возможный"

- **Oracle Cloud "Always Free"** — бессрочно бесплатный тариф (на данный момент: 4 ARM-ядра + 24 GB RAM, условия провайдера могут меняться — проверить на момент деплоя). Этого с большим запасом хватает под NestJS API + Postgres + Redis + MinIO + весь ML-пайплайн (Whisper/эмоции/Ollama) на CPU при 10 звонках/день — очередь не копится (см. расчёт в разделе 6). Реалистичный основной кандидат, а не запасной вариант.
- **Своё железо** (простаивающий ПК/сервер) — то же самое, но полностью под вашим контролем; отдельно поднимать сеть (белый IP или бесплатный туннель типа Cloudflare Tunnel), бэкапы, обновления, безопасность — придётся самим.
- **Supabase/Neon (Postgres) + Upstash (Redis) free tier** — альтернатива, если не хочется поднимать БД/очередь самим на Oracle-инстансе; сам ML-пайплайн (NestJS API + воркер) всё равно нужно где-то держать постоянно (см. выше).

**Вывод**: при заявленном объёме звонков **можно деплоить полностью бесплатно** (Oracle Always Free) без потери в архитектуре — единственная плата за "бесплатность" — фиксированные бесплатные ресурсы провайдера (не масштабируется само по себе при росте потока звонков, но для 10/день с запасом хватает).

### Обычный платный вариант (если бесплатный тариф не устраивает по другим причинам — например, нужны гарантии SLA/поддержки)

Один постоянный недорогой VPS без всякого GPU:

| Компонент | Где | Ориентир по цене |
|---|---|---|
| NestJS API + Postgres + Redis + MinIO + Whisper/эмоции/Ollama (всё на CPU) | Один VPS (Hetzner CPX31/41, Timeweb Cloud, Selectel — по региону), 4 vCPU / 8 GB RAM с запасом | ~$20-40/мес |

Отдельный GPU-сервер/почасовая аренда (RunPod/Vast.ai) при таком объёме не нужны — это стоит держать в уме только как задел на будущее, если поток звонков вырастет на порядок (сотни/тысячи в день) и CPU перестанет справляться в течение суток.
