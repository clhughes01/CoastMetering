# Quick Fix: AWS Textract Access Denied Error

## The Problem
You're seeing this error:
```
AccessDeniedException: User: arn:aws:iam::338295027531:user/chrislhughes is not authorized to perform: textract:AnalyzeDocument
```

This means your AWS user (`chrislhughes`) doesn't have permission to use Textract.

## The Solution (5 Minutes)

### Step 1: Go to IAM Users
1. Open [AWS Console](https://console.aws.amazon.com)
2. Search for **IAM** in the top search bar
3. Click **IAM** → **Users** in the left sidebar
4. Click on your username: **chrislhughes**

### Step 2: Add Textract Permissions
1. Click the **Permissions** tab
2. Click **Add permissions** button
3. Select **Attach policies directly**
4. In the search box, type: `AmazonTextractFullAccess`
5. Check the box next to **AmazonTextractFullAccess**
6. Click **Add permissions** at the bottom

### Step 3: Wait and Test
1. Wait 1-2 minutes for AWS to propagate the permissions
2. Go back to your app and try uploading a bill again
3. It should work now! ✅

## Visual Guide

```
AWS Console
  └─ IAM (search in top bar)
      └─ Users (left sidebar)
          └─ chrislhughes (click your username)
              └─ Permissions tab
                  └─ Add permissions button
                      └─ Attach policies directly
                          └─ Search: "AmazonTextractFullAccess"
                              └─ Check box → Add permissions
```

## Still Not Working?

1. **Double-check your credentials**: Make sure your `.env` file has the correct `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` that match the user you just updated
2. **Wait longer**: Sometimes AWS takes 2-3 minutes to propagate permissions
3. **Check the region**: Make sure `AWS_REGION` in your `.env` matches a region where Textract is available (e.g., `us-west-2`, `us-east-1`)
4. **Verify the policy**: Go back to IAM → Users → chrislhughes → Permissions and confirm you see `AmazonTextractFullAccess` listed

## Need More Help?

See the full setup guide: `docs/AWS_TEXTRACT_SETUP.md`
