import { TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react'

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className="overflow-x-auto">
        <table
          ref={ref}
          className={`w-full text-sm text-left ${className}`}
          {...props}
        >
          {children}
        </table>
      </div>
    )
  }
)
Table.displayName = 'Table'

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  TableHTMLAttributes<HTMLTableSectionElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <thead ref={ref} className={`bg-slate-50 ${className}`} {...props}>
      {children}
    </thead>
  )
})
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  TableHTMLAttributes<HTMLTableSectionElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <tbody ref={ref} className={`divide-y divide-slate-200 ${className}`} {...props}>
      {children}
    </tbody>
  )
})
TableBody.displayName = 'TableBody'

export const TableRow = forwardRef<
  HTMLTableRowElement,
  TableHTMLAttributes<HTMLTableRowElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <tr
      ref={ref}
      className={`hover:bg-slate-50 transition-colors ${className}`}
      {...props}
    >
      {children}
    </tr>
  )
})
TableRow.displayName = 'TableRow'

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${className}`}
        {...props}
      >
        {children}
      </th>
    )
  }
)
TableHead.displayName = 'TableHead'

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`px-4 py-3 text-slate-700 ${className}`}
        {...props}
      >
        {children}
      </td>
    )
  }
)
TableCell.displayName = 'TableCell'
