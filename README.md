# smp-duty-desktop

Компьютерная версия приложения «Наряд бригад СМП».

## Архитектура

- Electron + React + Vite
- Общий Supabase с существующим `smp-duty`
- Отдельный GitHub-репозиторий
- Существующий `smp-duty` не изменяется

## Запуск

Требуется Node.js 22.12+.

```bash
npm install
npm run desktop
```

## Сборка Windows

```bash
npm run dist
```

Результаты появятся в каталоге `release`.

## Этапы разработки

1. Базовое desktop-приложение.
2. Авторизация через существующий Supabase.
3. Рабочий экран наряда.
4. Бригады и сотрудники.
5. Сохранение и архив.
6. Печать.
7. Windows installer/portable.
8. Позже — локальная БД и offline/sync.
