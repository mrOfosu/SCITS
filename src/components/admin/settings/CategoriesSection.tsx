import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Tags, Plus, Pencil, Trash2, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  priority: string;
  subcategories: string[];
}

const defaultCategories: Category[] = [
  { id: "academic", name: "Academic Issues", priority: "medium", subcategories: ["Grading", "Exams", "Curriculum"] },
  { id: "infrastructure", name: "Infrastructure", priority: "high", subcategories: ["Classrooms", "Labs", "Hostels"] },
  { id: "administrative", name: "Administrative", priority: "medium", subcategories: ["Enrollment", "Fees", "Documents"] },
  { id: "other", name: "Other", priority: "low", subcategories: [] },
];

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem("complaint-categories");
    return saved ? JSON.parse(saved) : defaultCategories;
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPriority, setNewCatPriority] = useState("medium");
  const [newSubcat, setNewSubcat] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const save = (updated: Category[]) => {
    setCategories(updated);
    localStorage.setItem("complaint-categories", JSON.stringify(updated));
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.toLowerCase().replace(/\s+/g, "-");
    if (categories.find(c => c.id === id)) {
      toast({ title: "Category already exists", variant: "destructive" });
      return;
    }
    save([...categories, { id, name: newCatName.trim(), priority: newCatPriority, subcategories: [] }]);
    setNewCatName("");
    setNewCatPriority("medium");
    setShowAdd(false);
    toast({ title: "Category added" });
  };

  const deleteCategory = (id: string) => {
    save(categories.filter(c => c.id !== id));
    toast({ title: "Category deleted" });
  };

  const updatePriority = (id: string, priority: string) => {
    save(categories.map(c => c.id === id ? { ...c, priority } : c));
  };

  const addSubcategory = (catId: string) => {
    if (!newSubcat.trim()) return;
    save(categories.map(c =>
      c.id === catId
        ? { ...c, subcategories: [...c.subcategories, newSubcat.trim()] }
        : c
    ));
    setNewSubcat("");
  };

  const removeSubcategory = (catId: string, sub: string) => {
    save(categories.map(c =>
      c.id === catId
        ? { ...c, subcategories: c.subcategories.filter(s => s !== sub) }
        : c
    ));
  };

  const priorityColor = (p: string) => {
    if (p === "high") return "destructive";
    if (p === "low") return "secondary";
    return "default";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Complaint Categories</h2>
          <p className="text-sm text-muted-foreground">Manage categories and subcategories</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Category
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Bullying" />
              </div>
              <div className="space-y-2">
                <Label>Default Priority</Label>
                <Select value={newCatPriority} onValueChange={setNewCatPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addCategory} size="sm">Create</Button>
              <Button onClick={() => setShowAdd(false)} size="sm" variant="outline">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  {cat.name}
                  <Badge variant={priorityColor(cat.priority) as any} className="ml-2 text-xs">
                    {cat.priority}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={cat.priority} onValueChange={(v) => updatePriority(cat.id, v)}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteCategory(cat.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {cat.subcategories.map(sub => (
                  <Badge key={sub} variant="outline" className="flex items-center gap-1">
                    {sub}
                    <button onClick={() => removeSubcategory(cat.id, sub)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {cat.subcategories.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No subcategories</p>
                )}
              </div>
              {editingId === cat.id ? (
                <div className="flex gap-2">
                  <Input
                    value={newSubcat}
                    onChange={e => setNewSubcat(e.target.value)}
                    placeholder="Subcategory name"
                    className="h-8 text-sm"
                    onKeyDown={e => e.key === "Enter" && addSubcategory(cat.id)}
                  />
                  <Button size="sm" className="h-8" onClick={() => addSubcategory(cat.id)}>Add</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditingId(null); setNewSubcat(""); }}>Done</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(cat.id)}>
                  <Plus className="mr-1 h-3 w-3" /> Add Subcategory
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
