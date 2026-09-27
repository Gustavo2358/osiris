import java.nio.file.*;
import java.security.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.gustavo2358.air.model.Ids;
import io.github.gustavo2358.air.validation.ValidationResult;
import io.github.gustavo2358.lower.application.*;
import io.github.gustavo2358.lower.adapters.sp.*;
import io.github.gustavo2358.lower.adapters.air.AirFileOutput;
import io.github.gustavo2358.lower.adapters.cli.CobolLower;
import io.github.gustavo2358.lower.adapters.source.QualifiedSourceFileOutput;

/** Serializes the lowerer's public typed links; never reconstructs source identity. */
public final class ExportLinks {
    static Map<String,Object> id(Ids.Id id) {
        if(id instanceof Ids.PublicationId p) return Map.of("domain","publication","localId",p.localId());
        if(id instanceof Ids.UnitId u) return Map.of("domain","unit","publication",u.publication().localId(),"localId",u.localId());
        if(id instanceof Ids.OperationId o) return scoped("operation",o.unit(),o.localId());
        if(id instanceof Ids.LabelId l) return scoped("label",l.unit(),l.localId());
        if(id instanceof Ids.EntryId e) return scoped("entry",e.unit(),e.localId());
        if(id instanceof Ids.OriginId o) return Map.of("domain","origin","publication",o.publication().localId(),"localId",o.localId());
        throw new IllegalArgumentException("Unsupported link identity: "+id);
    }
    static Map<String,Object> scoped(String domain,Ids.UnitId u,String local) {return Map.of("domain",domain,"publication",u.publication().localId(),"unit",u.localId(),"localId",local);}
    static String sha(Path p)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(p)));}
    public static void main(String[] args)throws Exception {
        if(args.length!=4)throw new IllegalArgumentException("ExportLinks <sp.json> <air.json> <links.json> <source-evidence.json>");
        var sp=Path.of(args[0]);var air=Path.of(args[1]);var dest=Path.of(args[2]);
        if(Files.exists(air)||Files.exists(dest))throw new IllegalArgumentException("Use fresh output paths to preserve evidence");
        var result=new FileLowering(new SpFileInput(CobolLower.INPUT_LIMITS),new CobolLowerer()).lower(sp,CobolLower.POSITIVE_OPTIONS,true);
        if(!(result instanceof FileLowering.Lowered lowered))throw new IllegalStateException(result.toString());
        var r=lowered.result();var publication=r.publication().orElseThrow(()->new IllegalStateException(r.status()+": "+r.admission()));
        var writer=new AirFileOutput();
        if(r.validation().orElseThrow().status()==ValidationResult.Status.INCOMPLETE_VALIDATION)writer.writePartial(publication,air);else writer.write(publication,air);
        new QualifiedSourceFileOutput().write(lowered,CobolLower.POSITIVE_OPTIONS,air,Path.of(args[3]));
        var links=new LinkedHashMap<String,Object>();
        links.put("schema","cobol-explorer-links");links.put("version","1.0.0");links.put("publication",id(publication.id()));
        links.put("spSha256",sha(sp));links.put("airSha256",sha(air));links.put("loweringStatus",r.status().name());
        links.put("statements",r.statements().stream().map(l->Map.of("source",l.source(),"target",id(l.target()),"label",id(l.label()),"origin",id(l.origin()))).toList());
        links.put("entries",r.entries().stream().map(l->Map.of("source",l.source(),"target",id(l.target()),"start",id(l.start()),"origin",id(l.origin()))).toList());
        links.put("limitations",r.limitations());
        new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(dest.toFile(),links);
        System.out.println(r.status()+"; "+r.statements().size()+" statement links; "+r.entries().size()+" entry links");
    }
}
