"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/dashboard/profile/actions";
import { FormAlert } from "@/components/forms/form-alert";
import {
  controlClassName,
  fieldDescribedBy,
  FormField,
  selectTriggerClassName,
} from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useActionForm } from "@/components/forms/use-action-form";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CAREER_GOALS, EXPERIENCE_LEVELS } from "@/lib/profile/options";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";

const BIO_MAX = 600;

type ProfileFormProps = {
  defaultValues: Required<Omit<ProfileInput, "currentPassword">>;
  hasPassword: boolean;
};

export function ProfileForm({ defaultValues, hasPassword }: ProfileFormProps) {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { ...defaultValues, currentPassword: "" },
  });
  const { pending, formError, run } = useActionForm(form);
  const { errors, isDirty } = form.formState;
  const [email, image, bio, firstName, lastName, displayName] = useWatch({
    control: form.control,
    name: ["email", "image", "bio", "firstName", "lastName", "displayName"],
  });

  const emailChanged = email.trim().toLowerCase() !== defaultValues.email;
  const previewName = displayName || [firstName, lastName].filter(Boolean).join(" ") || email;

  // handleSubmit runs client validation; the server receives the raw input and
  // re-validates it with the same schema (the transformed output isn't re-parseable).
  const onSubmit = form.handleSubmit(() =>
    run(
      () => updateProfileAction(form.getValues()),
      () => {
        toast.success("Profile saved");
        // New baseline: the saved values, with the password field cleared.
        form.reset({ ...form.getValues(), currentPassword: "" });
        router.refresh();
      },
    ),
  );

  return (
    <form noValidate onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Only you can see these unless you publish your Skill Passport.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {formError && <FormAlert>{formError}</FormAlert>}

          <div className="flex items-center gap-4">
            <UserAvatar
              name={previewName}
              image={errors.image ? null : image}
              className="size-14"
            />
            <FormField
              id="image"
              label="Profile image URL"
              error={errors.image?.message}
              hint="Link to an https:// image. Uploads arrive in a later release."
              className="flex-1"
            >
              <Input
                id="image"
                type="url"
                inputMode="url"
                placeholder="https://…"
                className={controlClassName}
                aria-invalid={Boolean(errors.image)}
                aria-describedby={fieldDescribedBy("image", errors.image?.message, true)}
                {...form.register("image")}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstName" label="First name" error={errors.firstName?.message}>
              <Input
                id="firstName"
                autoComplete="given-name"
                className={controlClassName}
                aria-invalid={Boolean(errors.firstName)}
                aria-describedby={fieldDescribedBy("firstName", errors.firstName?.message)}
                {...form.register("firstName")}
              />
            </FormField>
            <FormField id="lastName" label="Last name" error={errors.lastName?.message}>
              <Input
                id="lastName"
                autoComplete="family-name"
                className={controlClassName}
                aria-invalid={Boolean(errors.lastName)}
                aria-describedby={fieldDescribedBy("lastName", errors.lastName?.message)}
                {...form.register("lastName")}
              />
            </FormField>
            <FormField
              id="displayName"
              label="Display name"
              error={errors.displayName?.message}
              hint="Shown in the app and on your passport."
            >
              <Input
                id="displayName"
                autoComplete="nickname"
                className={controlClassName}
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={fieldDescribedBy(
                  "displayName",
                  errors.displayName?.message,
                  true,
                )}
                {...form.register("displayName")}
              />
            </FormField>
            <FormField id="location" label="Location" error={errors.location?.message}>
              <Input
                id="location"
                autoComplete="address-level2"
                placeholder="City, Country"
                className={controlClassName}
                aria-invalid={Boolean(errors.location)}
                aria-describedby={fieldDescribedBy("location", errors.location?.message)}
                {...form.register("location")}
              />
            </FormField>
          </div>

          <div className="grid gap-4">
            <FormField id="email" label="Email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className={controlClassName}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={fieldDescribedBy("email", errors.email?.message)}
                {...form.register("email")}
              />
            </FormField>
            {emailChanged && hasPassword && (
              <FormField
                id="currentPassword"
                label="Current password"
                error={errors.currentPassword?.message}
                hint="Required to change your email."
              >
                <PasswordInput
                  id="currentPassword"
                  autoComplete="current-password"
                  className={controlClassName}
                  aria-invalid={Boolean(errors.currentPassword)}
                  aria-describedby={fieldDescribedBy(
                    "currentPassword",
                    errors.currentPassword?.message,
                    true,
                  )}
                  {...form.register("currentPassword")}
                />
              </FormField>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="careerGoal" label="Career goal" error={errors.careerGoal?.message}>
              <Controller
                control={form.control}
                name="careerGoal"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="careerGoal"
                      className={selectTriggerClassName}
                      aria-invalid={Boolean(errors.careerGoal)}
                    >
                      <SelectValue placeholder="Select a goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAREER_GOALS.map((goal) => (
                        <SelectItem key={goal.value} value={goal.value}>
                          {goal.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="experienceLevel"
              label="Current experience level"
              error={errors.experienceLevel?.message}
            >
              <Controller
                control={form.control}
                name="experienceLevel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="experienceLevel"
                      className={selectTriggerClassName}
                      aria-invalid={Boolean(errors.experienceLevel)}
                    >
                      <SelectValue placeholder="Select a level" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField
            id="bio"
            label="Bio"
            error={errors.bio?.message}
            hint={`${bio.length}/${BIO_MAX} characters`}
          >
            <Textarea
              id="bio"
              rows={5}
              maxLength={BIO_MAX}
              placeholder="A few sentences about your background and what you're working toward."
              className="min-h-28"
              aria-invalid={Boolean(errors.bio)}
              aria-describedby={fieldDescribedBy("bio", errors.bio?.message, true)}
              {...form.register("bio")}
            />
          </FormField>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-10 md:h-9"
              disabled={!isDirty || pending}
              onClick={() => form.reset()}
            >
              Discard changes
            </Button>
            <Button type="submit" className="h-10 md:h-9" disabled={!isDirty || pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
