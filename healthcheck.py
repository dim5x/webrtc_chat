#!/usr/bin/env python3
import asyncio
import sys


# async def main():
#     print('lol kek')
#     try:
#         timeout = aiohttp.ClientTimeout(total=5)
#         async with aiohttp.ClientSession(timeout=timeout) as session:
#             async with session.get('https://webrtcchat-production.up.railway.app') as response:
#                 sys.exit(0 if response.status == 200 else 1)
#     except Exception:
#         sys.exit(1)

async def main():
    print('lol kek - healthcheck запущен!')

    # Добавьте временную ошибку для теста
    if not hasattr(main, '_tested'):
        main._tested = True
        print('Первый запуск - симулируем ошибку')
        sys.exit(1)  # Первый раз失敗

    # Здесь ваш реальный healthcheck код
    try:
        # Ваша реальная проверка здоровья
        sys.exit(0)
    except Exception as e:
        print(f'Ошибка: {e}')
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

if __name__ == "__main__":
    asyncio.run(main())