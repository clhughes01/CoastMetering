# Textract Supported File Formats

## Supported Formats

AWS Textract's `AnalyzeDocument` API supports:
- **PNG** (`.png`) - Best for scanned documents
- **JPEG/JPG** (`.jpg`, `.jpeg`) - Best for scanned documents
- **PDF** (`.pdf`) - Text-based PDFs work best

## Important Limitations

### PDF Files
- ✅ **Text-based PDFs**: Work great (PDFs created from Word, etc.)
- ⚠️ **Scanned/Image PDFs**: May not work with `AnalyzeDocument`
  - If you have a scanned PDF, try converting it to PNG or JPEG first
  - Multi-page scanned PDFs need special handling

### File Size
- Maximum file size: **10MB** for synchronous operations
- For larger files, you'd need to use async processing (not yet implemented)

### Other Limitations
- ❌ Password-protected PDFs won't work
- ❌ Corrupted files won't work
- ❌ Very low-quality images may fail

## Best Practices

### For Best Results:
1. **Use PNG or JPEG for scanned documents**
   - Better OCR accuracy
   - More reliable than scanned PDFs
   - Easy to convert from PDF using online tools or Preview (Mac)

2. **Use text-based PDFs when possible**
   - If the PDF has selectable text, it's text-based
   - These work perfectly with Textract

3. **Ensure good image quality**
   - Clear, high-resolution images work best
   - Avoid blurry or low-contrast images

## Converting Files

### Mac (Preview)
1. Open PDF in Preview
2. File → Export
3. Choose PNG or JPEG format
4. Save and upload

### Online Tools
- [PDF24](https://tools.pdf24.org/en/pdf-to-jpg) - PDF to JPG converter
- [ILovePDF](https://www.ilovepdf.com/pdf-to-jpg) - PDF to JPG converter
- [CloudConvert](https://cloudconvert.com/pdf-to-png) - PDF to PNG converter

## Troubleshooting

### "Unsupported Document Format" Error

**If you're uploading a PDF:**
1. Try converting it to PNG or JPEG first
2. Make sure it's not password-protected
3. Verify the file isn't corrupted (try opening it in another app)

**If you're uploading an image:**
1. Make sure it's PNG or JPEG (not GIF, WebP, etc.)
2. Check the file size (should be under 10MB)
3. Try a different image to rule out corruption

### Still Not Working?

1. **Try a different file format**: Convert PDF → PNG/JPEG
2. **Check file size**: Should be under 10MB
3. **Verify file isn't corrupted**: Open it in another application
4. **Use a text-based PDF**: If possible, use a PDF with selectable text
