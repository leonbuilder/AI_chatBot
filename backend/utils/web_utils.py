import requests
from bs4 import BeautifulSoup
import logging
from typing import Optional, Dict, Any, Union, List
from urllib.parse import urljoin, urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_website_content(url: str, max_length: int = 15000) -> Dict[str, Any]:
    """
    Extract content from a website URL
    
    Args:
        url: The website URL to extract content from
        max_length: Maximum length of content to extract
        
    Returns:
        A dictionary containing the extracted title, content, and metadata
    """
    try:
        logger.info(f"Extracting content from {url}")
        
        # Make sure URL has scheme
        if not urlparse(url).scheme:
            url = f"https://{url}"
        
        # Fetch webpage
        response = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
            timeout=10
        )
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, "lxml")
        
        # Extract title
        title = ""
        if soup.title:
            title = soup.title.text.strip()
        
        # Extract metadata
        meta_description = ""
        meta_tags = soup.find_all("meta")
        for tag in meta_tags:
            if tag.get("name") == "description" or tag.get("property") == "og:description":
                meta_description = tag.get("content", "")
                break
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.extract()
        
        # Extract text from paragraphs, headers, and lists
        content_elements = soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"])
        content = []
        
        for element in content_elements:
            text = element.get_text().strip()
            if text and len(text) > 20:  # Ignore very short text
                content.append(text)
        
        # Join content
        full_content = "\n\n".join(content)
        
        # Trim content if too long
        if len(full_content) > max_length:
            full_content = full_content[:max_length] + "..."
        
        return {
            "title": title,
            "description": meta_description,
            "content": full_content,
            "url": url,
            "success": True
        }
            
    except Exception as e:
        logger.error(f"Error extracting content from {url}: {str(e)}")
        return {
            "title": "",
            "description": "",
            "content": f"Error extracting content: {str(e)}",
            "url": url,
            "success": False
        }

def extract_links(url: str) -> List[str]:
    """
    Extract links from a webpage
    
    Args:
        url: The URL to extract links from
        
    Returns:
        A list of absolute URLs
    """
    try:
        # Make sure URL has scheme
        if not urlparse(url).scheme:
            url = f"https://{url}"
        
        # Fetch webpage
        response = requests.get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
            timeout=10
        )
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, "lxml")
        
        # Find all links
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            
            # Skip anchor links, javascript, and mailto
            if href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
                continue
            
            # Convert relative URLs to absolute
            absolute_url = urljoin(url, href)
            
            # Only include links from the same domain
            if urlparse(absolute_url).netloc == urlparse(url).netloc:
                links.append(absolute_url)
        
        # Remove duplicates
        return list(set(links))
        
    except Exception as e:
        logger.error(f"Error extracting links from {url}: {str(e)}")
        return []

def extract_website_with_subpages(url: str, max_pages: int = 3, max_length_per_page: int = 5000) -> Dict[str, Any]:
    """
    Extract content from a website URL and a limited number of its subpages
    
    Args:
        url: The main website URL to extract content from
        max_pages: Maximum number of pages to extract (including the main page)
        max_length_per_page: Maximum length of content to extract per page
        
    Returns:
        A dictionary containing the extracted content from all pages
    """
    try:
        # Extract content from main page
        main_content = extract_website_content(url, max_length_per_page)
        
        if not main_content["success"]:
            return main_content
        
        # Initialize combined content
        combined_content = main_content["content"]
        pages_extracted = 1
        
        # Extract links from main page
        if pages_extracted < max_pages:
            links = extract_links(url)
            
            # Extract content from subpages
            for link in links:
                if pages_extracted >= max_pages:
                    break
                
                # Extract content from subpage
                subpage_content = extract_website_content(link, max_length_per_page)
                
                if subpage_content["success"]:
                    # Add subpage content to combined content
                    combined_content += f"\n\n--- Page: {subpage_content['title']} ({link}) ---\n\n"
                    combined_content += subpage_content["content"]
                    pages_extracted += 1
        
        return {
            "title": main_content["title"],
            "description": main_content["description"],
            "content": combined_content,
            "url": url,
            "pages_extracted": pages_extracted,
            "success": True
        }
            
    except Exception as e:
        logger.error(f"Error extracting website with subpages from {url}: {str(e)}")
        return {
            "title": "",
            "description": "",
            "content": f"Error extracting content: {str(e)}",
            "url": url,
            "pages_extracted": 0,
            "success": False
        } 