import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedResume {
  name: string | null
  name_kana: string | null
  birth_date: string | null
  gender: 'male' | 'female' | null
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  education: string | null
  work_history_1: string | null
  work_history_2: string | null
  work_history_3: string | null
  qualifications: string | null
  hobbies: string | null
}

const PARSE_PROMPT = `この履歴書の画像/PDFを解析し、以下の情報をJSON形式で抽出してください。
読み取れない・該当しない項目はnullにしてください。

出力フォーマット（JSONのみ、説明文不要）:
{
  "name": "氏名（漢字）",
  "name_kana": "フリガナ（カタカナ）",
  "birth_date": "生年月日（YYYY-MM-DD形式）",
  "gender": "male または female",
  "postal_code": "郵便番号（ハイフンなし7桁）",
  "prefecture": "都道府県",
  "city": "市区町村",
  "address": "番地以降の住所",
  "phone": "電話番号（ハイフンなし）",
  "email": "メールアドレス",
  "education": "最終学歴（学校名と卒業年月を1行で）",
  "work_history_1": "職歴1（会社名・期間・職種を1行で）",
  "work_history_2": "職歴2（会社名・期間・職種を1行で）",
  "work_history_3": "職歴3（会社名・期間・職種を1行で）",
  "qualifications": "資格・免許（カンマ区切り）",
  "hobbies": "趣味・特技"
}

重要:
- JSONのみ出力し、\`\`\`jsonなどのマークダウン記法は含めないでください
- 日本の履歴書フォーマットに従って解析してください
- 生年月日は和暦で書かれている場合はYYYY-MM-DD形式に変換してください
- 電話番号はハイフンを除去して数字のみにしてください`

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { fileBase64, mediaType } = await req.json() as {
      fileBase64: string
      mediaType: string
    }

    if (!fileBase64 || !mediaType) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 and mediaType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Claude APIにVisionリクエストを送信
    const isPdf = mediaType === 'application/pdf'
    const contentBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: mediaType, data: fileBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: fileBase64 } }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: PARSE_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      return new Response(
        JSON.stringify({ error: `Claude API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    const textContent = result.content?.find((c: any) => c.type === 'text')?.text

    if (!textContent) {
      return new Response(
        JSON.stringify({ error: 'No text response from Claude' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // JSONをパース（余分なテキストがある場合に対応）
    let parsed: ParsedResume
    try {
      // まず直接パース
      parsed = JSON.parse(textContent)
    } catch {
      // JSON部分を抽出して再試行
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to parse Claude response as JSON', raw: textContent }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ data: parsed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
