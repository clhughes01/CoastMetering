# AWS Textract Setup Guide

This guide explains how to set up AWS Textract for automatic bill data extraction.

## Overview

AWS Textract is used to extract data from water bills (PDF, PNG, JPEG) automatically. This will eventually be integrated into the bill processing workflow to automatically extract information and generate tenant statements.

## Prerequisites

1. An AWS account
2. AWS Textract service access
3. AWS credentials (Access Key ID and Secret Access Key)

## Step 1: Create AWS Account and Get Credentials

1. Go to [AWS Console](https://console.aws.amazon.com)
2. Sign in or create an account
3. Navigate to **IAM** (Identity and Access Management)
4. Go to **Users** → **Your Username** → **Security credentials**
5. Click **Create access key**
6. Choose **Application running outside AWS**
7. Download or copy:
   - **Access key ID**
   - **Secret access key**

⚠️ **Important**: Keep these credentials secure! Never commit them to git.

## Step 1.5: Grant Textract Permissions (CRITICAL!)

**This is the step that's causing your error!** Your AWS user needs permission to use Textract.

### Option A: Attach the Full Textract Policy (Easiest)

1. In AWS Console, go to **IAM** → **Users**
2. Click on your user (e.g., `chrislhughes`)
3. Click the **Permissions** tab
4. Click **Add permissions** → **Attach policies directly**
5. In the search box, type: `AmazonTextractFullAccess`
6. Check the box next to **AmazonTextractFullAccess**
7. Click **Add permissions** at the bottom
8. Wait a few seconds for the policy to propagate

### Option B: Create a Custom Policy (More Secure)

If you want to limit permissions to only what's needed:

1. In AWS Console, go to **IAM** → **Policies**
2. Click **Create policy**
3. Click the **JSON** tab
4. Paste this policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:AnalyzeDocument",
        "textract:DetectDocumentText",
        "textract:AnalyzeExpense",
        "textract:AnalyzeID"
      ],
      "Resource": "*"
    }
  ]
}
```
5. Click **Next**
6. Name it: `TextractReadOnlyAccess`
7. Click **Create policy**
8. Go back to **IAM** → **Users** → Your User → **Permissions**
9. Click **Add permissions** → **Attach policies directly**
10. Search for `TextractReadOnlyAccess` and attach it

**After adding permissions, wait 1-2 minutes for them to take effect, then try again!**

## Step 2: Verify Textract Service Access

Textract is automatically available in your AWS account - you don't need to "enable" it. However, you do need the permissions from Step 1.5 above.

To verify:
1. In AWS Console, search for **Textract**
2. Click on **Amazon Textract**
3. You should see the Textract dashboard (if you have permissions)
4. Note which region you want to use (e.g., `us-west-2`, `us-east-1`)

## Step 3: Add Credentials to Environment Variables

Add these to your `.env` file:

```env
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-west-2
```

Replace:
- `your_access_key_id_here` with your actual Access Key ID
- `your_secret_access_key_here` with your actual Secret Access Key
- `us-west-2` with your preferred AWS region

## Step 4: Install Dependencies

The AWS SDK is already added to `package.json`. Run:

```bash
npm install
```

## Step 5: Test the Integration

1. Go to the manager portal
2. Navigate to **Utility Statements** → **Textract Test**
3. Upload a water bill (PDF, PNG, or JPEG)
4. Click **Analyze Document**
5. Review the extracted data:
   - **Key-Value Pairs**: Form fields and values (e.g., "Account Number: 12345")
   - **Tables**: Any tables found in the document
   - **Extracted Text**: All text from the document

## How It Works

1. **Upload**: User uploads a bill document
2. **API Route**: `/api/textract/analyze` receives the file
3. **Textract Processing**: AWS Textract analyzes the document using:
   - `TABLES` feature: Extracts table data
   - `FORMS` feature: Extracts key-value pairs
4. **Data Processing**: The response is processed to extract:
   - Key-value pairs (form fields)
   - Tables (structured data)
   - Plain text (all text content)
5. **Display**: Extracted data is shown in organized sections

## Cost Considerations

AWS Textract pricing (as of 2024):
- **First 1,000 pages/month**: Free
- **Additional pages**: ~$1.50 per 1,000 pages

For testing and development, you'll likely stay within the free tier.

## Future Integration

Once the extraction is working well, this will be integrated into:
1. **Bill Upload Workflow**: Upload bills → Extract data → Auto-populate database
2. **Statement Generation**: Use extracted data to generate tenant statements
3. **Data Validation**: Compare extracted data with existing records

## Troubleshooting

### Error: "AWS credentials not configured"
- Make sure `.env` file has `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Restart your dev server after adding credentials

### Error: "Access Denied" or "not authorized to perform: textract:AnalyzeDocument"
- **This is a permissions issue!** Your AWS user doesn't have permission to use Textract
- Go to **IAM** → **Users** → Your User → **Permissions**
- Click **Add permissions** → **Attach policies directly**
- Search for and attach `AmazonTextractFullAccess`
- Wait 1-2 minutes for permissions to propagate, then try again
- If you still get errors, make sure you're using the correct AWS credentials in your `.env` file

### Error: "Invalid file type"
- Only PDF, PNG, and JPEG files are supported
- Make sure the file isn't corrupted

### No data extracted
- The document might not have clear text (scanned images need OCR)
- Try a clearer image or PDF with selectable text
- Check that the document isn't password-protected

## Security Notes

- Never commit AWS credentials to git
- Use environment variables for all AWS credentials
- Consider using AWS IAM roles if deploying to AWS infrastructure
- Rotate access keys regularly
