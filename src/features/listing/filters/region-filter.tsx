import { useQueryClient } from "@tanstack/react-query";
import { getRegions, type Region } from "@/entities/location/regions";
import { ReferenceMultiSelect } from "@/shared/ui/reference-multi-select";
export function RegionFilter({
  selected,
  onChange,
}: {
  selected: Region[];
  onChange: (value: Region[]) => void;
}) {
  const client = useQueryClient();
  return (
    <ReferenceMultiSelect<Region>
      label="Область"
      optional
      placeholder="Оберіть область"
      hint="Області та обрані населені пункти об’єднуються."
      queryKey={["region-options"]}
      fetchPage={async (search) => {
        const regions = await client.ensureQueryData({
          queryKey: ["regions"],
          queryFn: getRegions,
          staleTime: 60_000,
        });
        const data = regions.filter((region) =>
          region.name
            .toLocaleLowerCase("uk-UA")
            .includes(search.toLocaleLowerCase("uk-UA")),
        );
        return {
          data,
          meta: {
            page: 1,
            limit: 50,
            total: data.length,
            pages: data.length ? 1 : 0,
          },
        };
      }}
      itemLabel={(region) => region.name}
      selected={selected}
      onChange={onChange}
      rowHeight={64}
      desktopRowHeight={48}
    />
  );
}
