import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AstroNavigationItem } from "@shared/astroConfig";
import { ArrowDown, ArrowUp, GripVertical, Info, Menu, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { moveItem } from "./reorder";

export function NavigationEditor({
  items,
  onChange,
}: {
  items: AstroNavigationItem[];
  onChange: (next: AstroNavigationItem[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const update = (index: number, patch: Partial<AstroNavigationItem>) =>
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  const add = (type: AstroNavigationItem["type"]) =>
    onChange([
      ...items,
      {
        id: `nav-${type}-${Date.now()}`,
        type,
        label: type === "categories" ? "Products" : "New link",
        href: type === "categories" ? "" : "/",
        inHeader: true,
        inFooter: true,
      },
    ]);

  return (
    <div className="space-y-4">
      <Alert>
        <Info />
        <AlertTitle>Header and footer share this list</AlertTitle>
        <AlertDescription>
          Drag to set order. A categories item expands into the product groups you enable below.
        </AlertDescription>
      </Alert>

      {items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Menu />
            </EmptyMedia>
            <EmptyTitle>No navigation yet</EmptyTitle>
            <EmptyDescription>Add a page link or a products menu to start the header.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ButtonGroup>
              <Button type="button" variant="outline" onClick={() => add("link")}>
                <Plus className="h-4 w-4" />
                Add link
              </Button>
              <Button type="button" variant="outline" onClick={() => add("categories")}>
                <Plus className="h-4 w-4" />
                Add categories
              </Button>
            </ButtonGroup>
          </EmptyContent>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><span className="sr-only">Order</span></TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Shown in</TableHead>
              <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={item.id}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) onChange(moveItem(items, dragIndex, index));
                  setDragIndex(null);
                }}
                className="align-middle"
              >
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        className="inline-flex cursor-grab text-muted-foreground"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Drag to reorder</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-1.5">
                    <Select
                      value={item.type}
                      onValueChange={type =>
                        update(index, {
                          type: type as AstroNavigationItem["type"],
                          href: type === "categories" ? "" : item.href || "/",
                        })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Page link</SelectItem>
                        <SelectItem value="categories">Categories</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant={item.type === "categories" ? "default" : "secondary"}>
                      {item.type === "categories" ? "Menu" : "Link"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Input
                    aria-label="Navigation label"
                    value={item.label}
                    onChange={event => update(index, { label: event.target.value })}
                  />
                </TableCell>
                <TableCell className="whitespace-normal">
                  {item.type === "categories" ? (
                    <p className="text-xs text-muted-foreground">Opens the enabled product categories.</p>
                  ) : (
                    <Input
                      aria-label="Navigation link"
                      value={item.href}
                      onChange={event => update(index, { href: event.target.value })}
                      placeholder="/visit-us"
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-normal">
                      <Switch checked={item.inHeader} onCheckedChange={inHeader => update(index, { inHeader })} />
                      Header
                    </Label>
                    <Label className="text-xs font-normal">
                      <Switch checked={item.inFooter} onCheckedChange={inFooter => update(index, { inFooter })} />
                      Footer
                    </Label>
                  </div>
                </TableCell>
                <TableCell>
                  <ButtonGroup>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={index === 0}
                      aria-label={`Move ${item.label || "item"} up`}
                      onClick={() => onChange(moveItem(items, index, index - 1))}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={index === items.length - 1}
                      aria-label={`Move ${item.label || "item"} down`}
                      onClick={() => onChange(moveItem(items, index, index + 1))}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={`Remove ${item.label || "item"}`}
                      onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ButtonGroup>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {items.length > 0 ? (
        <ButtonGroup>
          <Button type="button" variant="outline" onClick={() => add("link")}>
            <Plus className="h-4 w-4" />
            Add link
          </Button>
          <Button type="button" variant="outline" onClick={() => add("categories")}>
            <Plus className="h-4 w-4" />
            Add categories menu
          </Button>
        </ButtonGroup>
      ) : null}
    </div>
  );
}
