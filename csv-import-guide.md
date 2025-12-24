# CSVインポート機能 開発指示書

## 📋 概要

スプレッドシートからの求職者データをCSVでインポートする機能。
月度ごとに約1,000〜2,000人のデータを取り込む。

---

## 🎯 画面

**パス**: `/candidates/import`

**UI要素**:
- CSVファイルアップロード（ドラッグ&ドロップ対応）
- プレビュー表示（最初の10件）
- インポート実行ボタン
- 結果表示（成功/失敗件数）

---

## 🔄 インポートロジック

### 重複チェック
- **キー**: 電話番号（phone）
- **既存あり** → candidatesは更新せず、applications/interviewsだけ追加
- **既存なし** → candidates新規作成 + applications/interviews追加

### データ振り分け
1行のCSVデータを3つのテーブルに振り分ける：
- `candidates`: 求職者基本情報
- `applications`: 応募履歴
- `interviews`: 面談情報（面談日がある場合のみ）

---

## 📊 CSVカラムマッピング

### CSV → candidates

| CSVカラム | DBカラム | 変換 |
|-----------|----------|------|
| 氏名(姓) + 氏名(名) | name | 結合（スペース区切り） |
| 氏名カナ(姓) + カナ(名)カナ | furigana | 結合（スペース区切り） |
| 電話番号 | phone | ハイフン除去して正規化 |
| 生年月日 | birth_date | DATE形式に変換 |
| 年齢 | age | INTEGER |
| 性別 | gender | そのまま |
| 郵便番号 | postal_code | そのまま |
| 都道府県 + 市区町村群 | address | 結合 |
| 身長 | height | INTEGER |
| 体重 | weight | INTEGER |
| タトゥー | tattoo | そのまま |
| 障害者手帳 | disability_certificate | そのまま |
| 持病 | medical_condition | そのまま |
| 配偶者 | has_spouse | "有"→true, それ以外→false |
| 子供 | has_children | "有"→true, それ以外→false |
| 担当CD | staff_id | employeesテーブルからID取得 |
| 状態 | status | マッピング（下記参照） |
| 最終連絡日 | last_contact_date | DATE形式 |
| 回数 | contact_count | INTEGER |
| 備考 | notes | そのまま |

### CSV → applications

| CSVカラム | DBカラム | 変換 |
|-----------|----------|------|
| 年月日 | application_date | DATE形式に変換 |
| 応募対応媒体 | source | そのまま |
| 職種 | job_article | そのまま |
| 状態 | status | そのまま |
| 勤務地 | notes | メモとして保存 |

### CSV → interviews（面談日がある場合のみ）

| CSVカラム | DBカラム | 変換 |
|-----------|----------|------|
| 日程_年 + 日程_月 + 日程_日 | interview_date | DATE形式に結合 |
| 日程_時間 | interview_time | TIME形式 |
| 担当CD | interviewer_id | employeesテーブルからID取得 |
| 繋ぎ状況 | result | "繋ぎ"/"繋げず"/NULL |
| 紹介先 | referred_company_id | companiesテーブルからID取得（名前で検索） |
| 備考 | notes | そのまま |

---

## 🔧 ステータスマッピング

### candidates.status
| CSVの値 | DBの値 |
|---------|--------|
| 有効 | 有効応募 |
| 無効 | 無効応募 |
| 電話出ず | 電話出ず |
| 時期先 | 就業時期が先 |

### candidates.current_stage
| CSVの値 | DBの値 |
|---------|--------|
| 新規 | 新規 |
| 面談済 | 面談済 |
| 紹介済 | 紹介済 |
| 稼働中 | 稼働中 |
| NG | NG |

---

## 📁 ファイル構成

```
app/
└── candidates/
    └── import/
        └── page.tsx          # インポート画面

components/
└── features/
    └── CsvImporter.tsx       # CSVインポートコンポーネント

lib/
└── csv-import.ts             # インポートロジック
```

---

## 💻 実装コード例

### インポート処理の流れ

```typescript
async function importCsv(rows: CsvRow[]) {
  const results = {
    newCandidates: 0,
    updatedCandidates: 0,
    newApplications: 0,
    newInterviews: 0,
    errors: []
  };

  for (const row of rows) {
    try {
      // 1. 電話番号で既存チェック
      const phone = normalizePhone(row['電話番号']);
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('phone', phone)
        .single();

      let candidateId: string;

      if (existing) {
        // 2a. 既存の場合 → IDを取得
        candidateId = existing.id;
        results.updatedCandidates++;
      } else {
        // 2b. 新規の場合 → candidates作成
        const { data: newCandidate } = await supabase
          .from('candidates')
          .insert({
            name: `${row['氏名(姓)']} ${row['氏名(名)']}`,
            furigana: `${row['氏名カナ(姓)']} ${row['カナ(名)カナ']}`,
            phone: phone,
            birth_date: parseDate(row['生年月日']),
            age: parseInt(row['年齢']) || null,
            gender: row['性別'],
            postal_code: row['郵便番号'],
            address: `${row['都道府県']}${row['市区町村群']}`,
            height: parseInt(row['身長']) || null,
            weight: parseInt(row['体重']) || null,
            tattoo: row['タトゥー'],
            disability_certificate: row['障害者手帳'],
            medical_condition: row['持病'],
            has_spouse: row['配偶者'] === '有',
            has_children: row['子供'] === '有',
            status: mapStatus(row['状態']),
            last_contact_date: parseDate(row['最終連絡日']),
            contact_count: parseInt(row['回数']) || 0,
            notes: row['備考']
          })
          .select()
          .single();

        candidateId = newCandidate.id;
        results.newCandidates++;
      }

      // 3. applications作成
      if (row['年月日']) {
        await supabase
          .from('applications')
          .insert({
            candidate_id: candidateId,
            application_date: parseDate(row['年月日']),
            source: row['応募対応媒体'],
            job_article: row['職種'],
            status: row['状態']
          });
        results.newApplications++;
      }

      // 4. interviews作成（面談日がある場合のみ）
      if (row['日程_年'] && row['日程_月'] && row['日程_日']) {
        const interviewDate = `${row['日程_年']}-${row['日程_月'].padStart(2, '0')}-${row['日程_日'].padStart(2, '0')}`;
        
        await supabase
          .from('interviews')
          .insert({
            candidate_id: candidateId,
            interview_date: interviewDate,
            interview_time: row['日程_時間'] || null,
            result: row['繋ぎ状況'] || null,
            notes: row['備考']
          });
        results.newInterviews++;
      }

    } catch (error) {
      results.errors.push({ row, error: error.message });
    }
  }

  return results;
}

// 電話番号正規化
function normalizePhone(phone: string): string {
  return phone?.replace(/[-\s]/g, '') || '';
}

// 日付パース
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // 様々なフォーマットに対応
  // 2024/1/15, 2024-01-15, など
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}
```

---

## 🎨 UI設計

### インポート画面

```
┌─────────────────────────────────────────────┐
│  📥 CSVインポート                            │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │   CSVファイルをドラッグ&ドロップ      │   │
│  │   または クリックして選択            │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  📋 プレビュー（最初の10件）                 │
│  ┌─────────────────────────────────────┐   │
│  │ 名前 | 電話番号 | 応募日 | 媒体      │   │
│  ├─────────────────────────────────────┤   │
│  │ 山田太郎 | 090-xxxx | 2024/12/1 | Indeed │
│  │ 佐藤花子 | 080-xxxx | 2024/12/2 | バイトル│
│  │ ...                                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  読み込み件数: 1,500件                       │
│                                             │
│  [ インポート実行 ]                          │
│                                             │
├─────────────────────────────────────────────┤
│  📊 結果                                    │
│  ✅ 新規求職者: 1,200件                      │
│  🔄 既存に応募追加: 300件                    │
│  📝 面談記録追加: 450件                      │
│  ❌ エラー: 0件                              │
└─────────────────────────────────────────────┘
```

---

## ⚠️ 注意事項

1. **大量データ対応**: 1,000件以上の場合、バッチ処理（100件ずつ）
2. **エラーハンドリング**: 1件のエラーで止まらない、続行して最後にエラー一覧表示
3. **担当者マッチング**: 担当CDがemployeesに存在しない場合はNULLにする
4. **企業マッチング**: 紹介先がcompaniesに存在しない場合はNULLにする

---

## 🚀 実装順序

1. インポート画面UI作成
2. CSVパース処理
3. candidates取り込み（重複チェック付き）
4. applications取り込み
5. interviews取り込み
6. 結果表示
7. エラーハンドリング
