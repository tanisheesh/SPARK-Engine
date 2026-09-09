import csv
import os
import random
import string
import time

FILE_NAME = "large_dataset.csv"
TARGET_SIZE = 1 * 1024 * 1024 * 1024  # 1 GB

# Sample data
CITIES = ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad"]
PRODUCTS = ["Laptop", "Phone", "Tablet", "Headphones", "Camera"]
PAYMENT_MODES = ["UPI", "Card", "NetBanking", "Cash"]

def random_string(length=10):
    return ''.join(random.choices(string.ascii_letters, k=length))

def generate_row():
    return [
        random.randint(100000, 999999),                     # user_id
        random_string(8),                                   # name
        random.choice(CITIES),                              # city
        random.choice(PRODUCTS),                            # product
        random.randint(1, 5),                               # quantity
        round(random.uniform(100, 50000), 2),               # price
        random.choice(PAYMENT_MODES),                       # payment mode
        time.strftime("%Y-%m-%d %H:%M:%S")                  # timestamp
    ]

def generate_csv():
    with open(FILE_NAME, "w", newline="", buffering=1024*1024) as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            "user_id", "name", "city", "product",
            "quantity", "price", "payment_mode", "timestamp"
        ])

        while True:
            # Write in batches (fast)
            rows = [generate_row() for _ in range(1000)]
            writer.writerows(rows)

            # Check file size
            if os.path.getsize(FILE_NAME) >= TARGET_SIZE:
                print("✅ CSV file reached 1 GB!")
                break

if __name__ == "__main__":
    print("Generating large CSV dataset... ⏳")
    generate_csv()