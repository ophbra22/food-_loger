import argparse
import os


def main():
    parser = argparse.ArgumentParser(description="FoodLogger local food journal")
    parser.add_argument("command", nargs="?", choices=["serve", "download-model"], default="serve")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    if args.command == "download-model":
        from foodlogger.classifier import download_weights

        print(f"Verified model checkpoint: {download_weights()}")
    else:
        import uvicorn

        uvicorn.run("foodlogger.app:create_app", factory=True, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
