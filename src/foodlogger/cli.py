import argparse
import os


def main():
    parser = argparse.ArgumentParser(description="FoodLogger food journal")
    parser.add_argument("command", nargs="?", choices=["serve", "download-model"], default="serve")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
    args = parser.parse_args()
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    if args.command == "download-model":
        from foodlogger.classifier import download_weights

        print(f"Verified model checkpoint: {download_weights()}")
    else:
        import uvicorn

        uvicorn.run(
            "foodlogger.app:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            workers=1,
            limit_concurrency=8,
            timeout_keep_alive=5,
            # Render terminates TLS at its trusted reverse proxy; never accept
            # forwarded client IPs from arbitrary clients for abuse limits.
            proxy_headers=False,
        )


if __name__ == "__main__":
    main()
