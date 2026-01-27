import { NextRequest, NextResponse } from 'next/server'
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract'

// Initialize Textract client
const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PNG, JPEG, or PDF file.' },
        { status: 400 }
      )
    }

    // Validate file size (Textract has a 10MB limit for synchronous operations)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB. For larger files, use multi-page PDF processing.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Additional validation: Check if PDF is actually readable
    if (file.type === 'application/pdf') {
      // Check if PDF starts with PDF magic bytes
      const pdfHeader = buffer.slice(0, 4).toString('ascii')
      if (pdfHeader !== '%PDF') {
        return NextResponse.json(
          { error: 'Invalid PDF file. The file may be corrupted or not a valid PDF.' },
          { status: 400 }
        )
      }
    }

    // Call AWS Textract
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: buffer,
      },
      FeatureTypes: ['TABLES', 'FORMS'], // Extract tables and forms (key-value pairs)
    })

    const response = await textractClient.send(command)

    if (!response.Blocks) {
      return NextResponse.json(
        { error: 'No data extracted from document' },
        { status: 500 }
      )
    }

    // Process the response to extract structured data
    const extractedData = processTextractResponse(response.Blocks)

    return NextResponse.json({
      success: true,
      raw: response.Blocks,
      extracted: extractedData,
      text: extractText(response.Blocks),
    })
  } catch (error: any) {
    console.error('Textract error:', error)
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to analyze document'
    let hint = 'Make sure AWS credentials are configured in your .env file'
    
    if (error.name === 'AccessDeniedException' || error.Code === 'AccessDeniedException') {
      errorMessage = 'Access Denied: Your AWS user does not have permission to use Textract'
      hint = 'Go to AWS Console → IAM → Users → Your User → Permissions → Add permissions → Attach "AmazonTextractFullAccess" policy. Wait 1-2 minutes and try again.'
    } else if (error.name === 'UnsupportedDocumentException' || error.Code === 'UnsupportedDocumentException') {
      errorMessage = 'Unsupported Document Format'
      hint = 'Textract supports PNG, JPEG, and PDF files. Make sure: 1) The file is not corrupted, 2) PDFs are text-based (not scanned images), 3) For scanned PDFs, try converting to PNG/JPEG first, 4) The file is not password-protected.'
    } else if (error.name === 'InvalidParameterException' || error.Code === 'InvalidParameterException') {
      errorMessage = 'Invalid Document Parameters'
      hint = 'The document may be too large, corrupted, or in an unsupported format. Try a smaller file or convert to PNG/JPEG.'
    } else if (error.message?.includes('credentials')) {
      errorMessage = 'AWS credentials not configured or invalid'
      hint = 'Check your .env file has AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION set correctly'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.message || error.Code || 'Unknown error',
        hint,
        code: error.Code || error.name
      },
      { status: 500 }
    )
  }
}

// Process Textract blocks to extract structured data
function processTextractResponse(blocks: any[]) {
  const result: any = {
    keyValuePairs: {},
    tables: [],
    text: '',
  }

  // Extract key-value pairs (FORMS)
  const keyValueMap = new Map()
  blocks.forEach(block => {
    if (block.BlockType === 'KEY_VALUE_SET') {
      if (block.EntityTypes?.includes('KEY')) {
        keyValueMap.set(block.Id, { key: block, value: null })
      } else if (block.EntityTypes?.includes('VALUE')) {
        // Find the corresponding key
        const relationships = block.Relationships || []
        relationships.forEach((rel: any) => {
          if (rel.Type === 'VALUE') {
            rel.Ids.forEach((id: string) => {
              if (keyValueMap.has(id)) {
                keyValueMap.get(id).value = block
              }
            })
          }
        })
      }
    }
  })

  // Extract text from key-value pairs
  keyValueMap.forEach(({ key, value }) => {
    const keyText = getTextFromBlock(key, blocks)
    const valueText = value ? getTextFromBlock(value, blocks) : ''
    if (keyText) {
      result.keyValuePairs[keyText] = valueText
    }
  })

  // Extract tables
  const tables = blocks.filter(b => b.BlockType === 'TABLE')
  tables.forEach(table => {
    const tableData = extractTable(table, blocks)
    if (tableData.length > 0) {
      result.tables.push(tableData)
    }
  })

  return result
}

// Get text from a block by following relationships
function getTextFromBlock(block: any, allBlocks: any[]): string {
  if (block.Text) {
    return block.Text
  }

  const words: string[] = []
  const relationships = block.Relationships || []
  
  relationships.forEach((rel: any) => {
    if (rel.Type === 'CHILD') {
      rel.Ids.forEach((id: string) => {
        const childBlock = allBlocks.find(b => b.Id === id)
        if (childBlock && childBlock.BlockType === 'WORD') {
          words.push(childBlock.Text || '')
        }
      })
    }
  })

  return words.join(' ')
}

// Extract table data
function extractTable(table: any, allBlocks: any[]): any[][] {
  const cells = new Map()
  const relationships = table.Relationships || []
  
  relationships.forEach((rel: any) => {
    if (rel.Type === 'CHILD') {
      rel.Ids.forEach((id: string) => {
        const cell = allBlocks.find(b => b.Id === id)
        if (cell && cell.BlockType === 'CELL') {
          const rowIndex = cell.RowIndex || 0
          const columnIndex = cell.ColumnIndex || 0
          const key = `${rowIndex}-${columnIndex}`
          cells.set(key, {
            row: rowIndex,
            col: columnIndex,
            text: getTextFromBlock(cell, allBlocks),
          })
        }
      })
    }
  })

  // Convert to 2D array
  const maxRow = Math.max(...Array.from(cells.values()).map(c => c.row), 0)
  const maxCol = Math.max(...Array.from(cells.values()).map(c => c.col), 0)
  const tableData: any[][] = []

  for (let row = 0; row <= maxRow; row++) {
    const rowData: any[] = []
    for (let col = 0; col <= maxCol; col++) {
      const key = `${row}-${col}`
      rowData.push(cells.get(key)?.text || '')
    }
    if (rowData.some(cell => cell)) {
      tableData.push(rowData)
    }
  }

  return tableData
}

// Extract plain text from all blocks
function extractText(blocks: any[]): string {
  const words = blocks
    .filter(b => b.BlockType === 'WORD' || b.BlockType === 'LINE')
    .map(b => b.Text || '')
    .filter(text => text.trim())
  
  return words.join(' ')
}
