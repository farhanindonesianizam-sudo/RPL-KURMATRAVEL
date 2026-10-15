import os

files = sorted(os.listdir("."))

i = 1
for file in files:
    if file.lower().endswith((".jpg", ".jpeg", ".png")):
        new_name = f"perlengkapan{i}.jpg"
        os.rename(file, new_name)
        i += 1

print("Rename selesai!")