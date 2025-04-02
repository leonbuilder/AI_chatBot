import sys
import os

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Try importing the necessary modules
try:
    import utils.web_utils
    print("Successfully imported utils.web_utils")
except ImportError as e:
    print(f"Failed to import utils.web_utils: {e}")

try:
    from utils.web_utils import extract_website_content
    print("Successfully imported extract_website_content")
except ImportError as e:
    print(f"Failed to import extract_website_content: {e}")

# Print the Python path
print("\nPython path:")
for path in sys.path:
    print(path)

# Print directory contents
print("\nContents of current directory:")
print(os.listdir('.'))

print("\nContents of utils directory:")
try:
    print(os.listdir('./utils'))
except FileNotFoundError:
    print("utils directory not found") 